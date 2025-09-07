import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { config } from 'dotenv';
import { createClient } from 'redis';
import { Server, Socket } from 'socket.io';
import { DrawDto } from './dto/draw.dto';
import { GuessDto } from './dto/guess.dto';
import { JoinGameDto } from './dto/join-game.dto';
import { GameService } from './game.service';

config(); // dotenv

/**
 * @WebSocketGateway: 이 클래스가 웹소켓 서버 게이트웨이임을 나타냅니다.
 * - namespace: '/game': 클라이언트가 접속할 네임스페이스를 지정합니다. (예: io('/game'))
 * - cors: Cross-Origin Resource Sharing 설정을 하여 다른 도메인에서의 접속을 허용합니다.
 */
@WebSocketGateway({ namespace: '/game', cors: { origin: '*' } })
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  // @WebSocketServer(): 게이트웨이에 주입된 Socket.IO 서버 인스턴스에 접근하기 위한 데코레이터
  @WebSocketServer() server: Server;
  private logger = new Logger(GameGateway.name);

  // GameService를 주입받아 게임 로직 처리를 위임합니다.
  constructor(private readonly gameService: GameService) {}

  // OnGatewayInit 인터페이스 구현: 게이트웨이가 초기화된 후 호출됩니다.
  async afterInit(server: Server) {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        // Redis 어댑터를 설정하여 여러 서버 인스턴스 간에 웹소켓 이벤트를 공유할 수 있도록 합니다. (스케일 아웃)
        const pubClient = createClient({ url: redisUrl });
        const subClient = pubClient.duplicate();
        await Promise.all([pubClient.connect(), subClient.connect()]);
        server.adapter(createAdapter(pubClient, subClient));
        this.logger.log('✅ Redis adapter connected to Socket.IO');
      } catch (err) {
        this.logger.error('Redis adapter connection failed', err);
      }
    }
  }

  // OnGatewayConnection 인터페이스 구현: 클라이언트가 연결되었을 때 호출됩니다.
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  // OnGatewayDisconnect 인터페이스 구현: 클라이언트 연결이 끊어졌을 때 호출됩니다.
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // 서비스에 알려 해당 플레이어를 모든 방에서 제거합니다.
    this.gameService.removePlayerFromAll(client.id);
  }

  /**
   * DTO(Data Transfer Object) 유효성 검사를 위한 헬퍼 메소드
   * @param cls DTO 클래스
   * @param payload 클라이언트로부터 받은 데이터
   */
  async validateDto<T>(cls: new () => T, payload: any) {
    const dto = plainToInstance(cls, payload);
    const errors = await validate(dto as any);
    if (errors.length) {
      throw new WsException('Validation failed');
    }
    return dto;
  }

  /**
   * 'joinGame' 이벤트를 구독합니다.
   * 클라이언트가 방에 참여할 때 호출됩니다.
   * @param payload 클라이언트가 보낸 데이터 (JoinGameDto 형태)
   * @param client 이벤트를 보낸 클라이언트의 소켓 객체
   */
  @SubscribeMessage('joinGame')
  async onJoin(@MessageBody() payload: any, @ConnectedSocket() client: Socket) {
    const dto = await this.validateDto(JoinGameDto, payload);
    // 1. 클라이언트를 특정 방(roomId)에 참가시킵니다.
    client.join(dto.roomId);
    // 2. GameService를 통해 플레이어 목록에 추가합니다.
    this.gameService.addPlayer(dto.roomId, client.id, dto.userName);

    const roomState = this.gameService.getRoomState(dto.roomId);
    const presenter = roomState.players.find(
      (p) => p.socketId === roomState.roundOwner,
    );

    // 3. 새로 참가한 클라이언트에게 현재 방의 상태(플레이어, 그림 등)를 보냅니다.
    client.emit('initialState', roomState);

    // 4. 방에 있는 다른 클라이언트들에게 새로운 유저가 참가했음을 알립니다.
    client
      .to(dto.roomId)
      .emit('userJoined', { id: client.id, name: dto.userName });

    // 5. 현재 출제자가 누구인지 방의 모든 클라이언트에게 알립니다.
    if (presenter) {
      this.server.to(dto.roomId).emit('presenterAssigned', {
        presenterId: presenter.socketId,
        presenterName: presenter.name,
      });

      // 6. 출제자에게만 문제 단어를 개인적으로 보냅니다.
      const word = this.gameService.getCurrentWord(dto.roomId);
      if (word) {
        this.server.to(presenter.socketId).emit('roundStarted', { word });
      }
    }
  }

  /**
   * 'drawing' 이벤트를 구독합니다.
   * 출제자가 그림을 그릴 때 호출됩니다.
   */
  @SubscribeMessage('drawing')
  async onDraw(@MessageBody() payload: any, @ConnectedSocket() client: Socket) {
    const dto = await this.validateDto(DrawDto, payload);
    const roomState = this.gameService.getRoomState(dto.roomId);

    // 보호 로직: 현재 출제자만 그림을 그릴 수 있습니다.
    if (client.id !== roomState.roundOwner) {
      this.logger.warn(
        `Client ${client.id} tried to draw but is not the presenter.`,
      );
      return; // 출제자가 아니면 아무 작업도 하지 않음
    }

    // 1. GameService에 그림 데이터를 추가합니다.
    this.gameService.appendShape(dto.roomId, dto.data);
    // 2. 자신을 제외한 방의 모든 클라이언트에게 그림 데이터를 전송합니다.
    client.broadcast
      .to(dto.roomId)
      .emit('drawing:remote', { from: client.id, data: dto.data });
  }

  /**
   * 'submitGuess' 이벤트를 구독합니다.
   * 참여자가 정답을 제출할 때 호출됩니다.
   */
  @SubscribeMessage('submitGuess')
  async onGuess(
    @MessageBody() payload: any,
    @ConnectedSocket() client: Socket,
  ) {
    const dto = await this.validateDto(GuessDto, payload);
    // 1. GameService를 통해 정답 여부를 확인합니다.
    const res = this.gameService.checkGuess(dto.roomId, client.id, dto.guess);

    const roomState = this.gameService.getRoomState(dto.roomId);
    const guesser = roomState.players.find((p) => p.socketId === client.id);

    // 2. 정답 추측 결과를 방의 모든 클라이언트에게 알립니다.
    this.server.to(dto.roomId).emit('guessResult', {
      from: client.id,
      playerName: guesser?.name,
      guess: dto.guess,
      ...res,
    });

    // 3. 만약 정답이 맞았다면, 다음 라운드를 시작하는 로직을 호출합니다.
    if (res.correct) {
      this.server.to(dto.roomId).emit('roundEnded', {
        winnerId: client.id,
        winnerName: guesser?.name,
        score: res.score,
      });

      // 3초 지연 후 다음 라운드를 시작하여, 플레이어가 결과를 인지할 시간을 줍니다.
      setTimeout(() => {
        const newRoundData = this.gameService.startNextRound(dto.roomId);
        if (newRoundData) {
          const { nextPresenter, newWord } = newRoundData;

          // 3a. 새 라운드 시작을 알려 클라이언트들이 캔버스를 지우도록 합니다.
          this.server.to(dto.roomId).emit('newRoundStarting');

          // 3b. 새로운 출제자를 모두에게 알립니다.
          this.server.to(dto.roomId).emit('presenterAssigned', {
            presenterId: nextPresenter.socketId,
            presenterName: nextPresenter.name,
          });

          // 3c. 새로운 출제자에게만 새로운 문제 단어를 보냅니다.
          this.server
            .to(nextPresenter.socketId)
            .emit('roundStarted', { word: newWord });
        }
      }, 3000); // 3-second delay
    }
  }

  /**
   * 'leaveGame' 이벤트를 구독합니다.
   * 클라이언트가 방을 나갈 때 호출됩니다. (현재 테스트 클라이언트에는 구현되지 않음)
   */
  @SubscribeMessage('leaveGame')
  async onLeave(
    @MessageBody() payload: any,
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId } = payload;
    client.leave(roomId);
    this.gameService.removePlayerFromAll(client.id);
    this.server.to(roomId).emit('userLeft', { id: client.id });
  }
}


import { Injectable } from '@nestjs/common';

// 게임에 사용될 문제 단어 목록 (목 데이터)
const mockWords = [
  '사과',
  '바나나',
  '컴퓨터',
  '자동차',
  '커피',
  '의자',
  '책상',
  '휴대폰',
  '자전거',
  '카메라',
];

// 플레이어의 상태를 정의하는 타입
type Player = {
  socketId: string; // 플레이어의 고유 소켓 ID
  name: string; // 플레이어 이름
  score: number; // 게임 점수
};

// 게임 방의 상태를 정의하는 타입
type Room = {
  id: string; // 방의 고유 ID
  players: Map<string, Player>; // 방에 있는 플레이어 목록 (socketId를 키로 사용)
  shapes: any[]; // 현재 라운드에 그려진 그림 데이터 배열
  currentWord?: string; // 현재 라운드의 정답 단어
  roundOwner?: string; // 현재 라운드의 출제자 socketId
};

/**
 * @Injectable(): 이 클래스를 NestJS의 DI(의존성 주입) 시스템에 등록합니다.
 * 게임의 핵심 로직과 상태 관리를 담당합니다.
 */
@Injectable()
export class GameService {
  // 모든 게임 방의 상태를 저장하는 Map (roomId를 키로 사용)
  private rooms = new Map<string, Room>();

  /**
   * 특정 roomId에 해당하는 방이 존재하는지 확인하고, 없으면 새로 생성합니다.
   * @param roomId 방 ID
   * @returns Room 객체
   */
  ensureRoom(roomId: string) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        players: new Map(),
        shapes: [],
      });
    }
    return this.rooms.get(roomId)!;
  }

  /**
   * 방에 새로운 플레이어를 추가합니다.
   * @param roomId 방 ID
   * @param socketId 플레이어의 소켓 ID
   * @param name 플레이어 이름
   */
  addPlayer(roomId: string, socketId: string, name: string) {
    const room = this.ensureRoom(roomId);
    room.players.set(socketId, { socketId, name, score: 0 });

    // 만약 방에 출제자가 없다면 (첫 번째 플레이어), 이 플레이어를 출제자로 지정하고 첫 문제를 할당합니다.
    if (!room.roundOwner) {
      room.roundOwner = socketId;
      const randomWord = mockWords[Math.floor(Math.random() * mockWords.length)];
      room.currentWord = randomWord;
    }
  }

  /**
   * 모든 방에서 특정 플레이어를 제거합니다. (주로 연결 종료 시 사용)
   * @param socketId 제거할 플레이어의 소켓 ID
   */
  removePlayerFromAll(socketId: string) {
    for (const room of this.rooms.values()) {
      if (room.players.has(socketId)) {
        room.players.delete(socketId);
        // TODO: 만약 나간 플레이어가 출제자였다면, 다음 라운드를 시작하는 로직 추가 필요
      }
    }
  }

  /**
   * 방의 그림 데이터(shapes) 배열에 새로운 그림 조각을 추가합니다.
   * @param roomId 방 ID
   * @param shape 그림 데이터
   */
  appendShape(roomId: string, shape: any) {
    const room = this.ensureRoom(roomId);
    room.shapes.push(shape);
  }

  /**
   * 클라이언트에게 전송할 현재 방의 상태 정보를 반환합니다.
   * 보안을 위해 정답 단어(`currentWord`)는 직접 노출하지 않고, 존재 여부만 불리언 값으로 보냅니다.
   * @param roomId 방 ID
   */
  getRoomState(roomId: string) {
    const room = this.ensureRoom(roomId);
    return {
      players: Array.from(room.players.values()),
      shapes: room.shapes,
      currentWord: room.currentWord ? true : false, // 정답 단어 자체는 숨김
      roundOwner: room.roundOwner,
    };
  }

  /**
   * 현재 방의 정답 단어를 반환합니다. (주로 게이트웨이에서 출제자에게 단어를 보낼 때 사용)
   * @param roomId 방 ID
   */
  getCurrentWord(roomId: string): string | undefined {
    return this.rooms.get(roomId)?.currentWord;
  }

  /**
   * 방의 문제 단어와 출제자를 설정합니다. (향후 특정 유저가 문제 내기 기능 등에 활용 가능)
   * @param roomId 방 ID
   * @param word 문제 단어
   * @param ownerSocketId 출제자 소켓 ID
   */
  setCurrentWord(roomId: string, word: string, ownerSocketId: string) {
    const room = this.ensureRoom(roomId);
    room.currentWord = word;
    room.roundOwner = ownerSocketId;
  }

  /**
   * 제출된 단어가 현재 라운드의 정답과 일치하는지 확인합니다.
   * @param roomId 방 ID
   * @param socketId 추측한 플레이어의 소켓 ID
   * @param guess 추측한 단어
   * @returns 정답 여부 및 점수 정보
   */
  checkGuess(roomId: string, socketId: string, guess: string) {
    const room = this.ensureRoom(roomId);
    if (!room.currentWord) return { correct: false };

    const isCorrect =
      room.currentWord.trim().toLowerCase() === guess.trim().toLowerCase();

    if (isCorrect) {
      // 정답을 맞혔을 경우, 간단한 점수 로직 적용
      const player = room.players.get(socketId);
      if (player) player.score += 10;
      return {
        correct: true,
        playerName: player?.name,
        score: player?.score ?? 0,
      };
    }
    return { correct: false };
  }

  /**
   * 다음 라운드를 시작합니다. 새로운 출제자를 정하고, 새 문제 단어를 할당하며, 이전 그림을 지웁니다.
   * @param roomId 방 ID
   * @returns 새로운 출제자 정보와 새로운 문제 단어
   */
  startNextRound(roomId: string) {
    const room = this.ensureRoom(roomId);
    if (room.players.size === 0) return null;

    const players = Array.from(room.players.values());
    const currentPresenterIndex = players.findIndex(
      (p) => p.socketId === room.roundOwner,
    );

    // 다음 출제자를 순서대로(Round-robin) 결정합니다.
    const nextPresenterIndex = (currentPresenterIndex + 1) % players.length;
    const nextPresenter = players[nextPresenterIndex];

    // 새 라운드를 위해 방 상태를 초기화합니다.
    room.roundOwner = nextPresenter.socketId; // 새 출제자 지정
    room.currentWord = mockWords[Math.floor(Math.random() * mockWords.length)]; // 새 문제 할당
    room.shapes = []; // 이전 그림 데이터 삭제

    return {
      nextPresenter,
      newWord: room.currentWord,
    };
  }
}

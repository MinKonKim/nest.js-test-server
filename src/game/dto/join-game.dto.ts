import { IsString, Length } from 'class-validator';

export class JoinGameDto {
  @IsString()
  @Length(1, 50)
  roomId: string;

  @IsString()
  @Length(1, 30)
  userName: string;
}

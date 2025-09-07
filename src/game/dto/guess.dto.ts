import { IsString } from 'class-validator';

export class GuessDto {
  @IsString()
  roomId: string;

  @IsString()
  guess: string;
}

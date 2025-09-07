import { IsObject, IsString } from 'class-validator';

export class DrawDto {
  @IsString()
  roomId: string;

  @IsObject()
  data: any; // tldraw에서 오는 stroke/patch 데이터(구조는 앱에서 정의)
}

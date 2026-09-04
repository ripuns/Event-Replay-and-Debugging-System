import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ maxLength: 255, example: 'CI deploy key' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ maxLength: 255, example: 'Billing' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
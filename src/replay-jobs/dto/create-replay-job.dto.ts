import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReplayJobDto {
  @ApiPropertyOptional({
    maxLength: 100,
    description:
      'Limit the job to aggregates of this type. Omit to target every aggregate in the project.',
    example: 'order',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  aggregateType?: string;
}

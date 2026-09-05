import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class AppendEventDto {
  @ApiProperty({ maxLength: 100, example: 'order' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  aggregateType!: string;

  @ApiProperty({ maxLength: 255, example: 'ord_123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  aggregateKey!: string;

  @ApiProperty({ maxLength: 255, example: 'OrderPlaced' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  eventType!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  eventVersion!: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsNotEmpty()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Defaults to the current time if omitted.',
    example: '2026-09-05T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

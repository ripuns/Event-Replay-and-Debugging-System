import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export enum EventReducerOperation {
  Set = 'set',
  Merge = 'merge',
  Append = 'append',
}

export class CreateEventReducerDto {
  @ApiProperty({ maxLength: 100, example: 'order' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  aggregateType!: string;

  @ApiProperty({ maxLength: 255, example: 'OrderShipped' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  eventType!: string;

  @ApiProperty({
    enum: EventReducerOperation,
    example: EventReducerOperation.Merge,
  })
  @IsEnum(EventReducerOperation)
  operation!: EventReducerOperation;

  @ApiPropertyOptional({
    maxLength: 255,
    description:
      'Target state field. Required for merge/append, ignored for set.',
    example: 'shipping',
  })
  @ValidateIf(
    (dto: CreateEventReducerDto) => dto.operation !== EventReducerOperation.Set,
  )
  @IsString()
  @IsNotEmpty({ message: 'field is required for merge/append operations' })
  @MaxLength(255)
  field?: string;
}

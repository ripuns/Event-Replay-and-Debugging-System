import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class FirstProjectDto {
  @ApiProperty({ maxLength: 255, example: 'Payments' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}

export class CreateOrganizationDto {
  @ApiProperty({ maxLength: 255, example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    type: FirstProjectDto,
    description:
      'Optionally create a first project and its API key in the same call, avoiding a separate bootstrap round trip.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FirstProjectDto)
  firstProject?: FirstProjectDto;
}

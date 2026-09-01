import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class FirstProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FirstProjectDto)
  firstProject?: FirstProjectDto;
}

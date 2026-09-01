import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ApiKeyGuard } from '../common/auth/api-key.guard';
import type { RequestContext } from '../common/auth/request-context';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto.name, dto.firstProject);
  }

  @Get(':id')
  @UseGuards(ApiKeyGuard)
  async findOne(@Param('id') id: string, @Req() request: RequestContext) {
    if (request.auth?.organizationId !== id) {
      throw new ForbiddenException('API key does not grant access to this organization');
    }

    const organization = await this.organizationService.findById(id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }
}

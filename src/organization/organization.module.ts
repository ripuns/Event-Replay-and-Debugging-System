import { OrganizationService } from "./organization.service";
import { OrganizationRepository } from "./organization.repository";
import { Module } from "@nestjs/common";

@Module({
    controllers: [OrganizationRepository],
    providers: [OrganizationService],
})
export class OrganizationModule {}
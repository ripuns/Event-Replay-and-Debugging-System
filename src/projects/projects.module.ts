import { Module } from "@nestjs/common";
import { ProjectsRepository } from "./projects.repository";
import { ProjectsService } from "./projects.service";
import { PrismaService } from "src/prisma/prisma.service";

@Module({
    providers: [
        ProjectsService,
        ProjectsRepository,
        PrismaService
    ],
    exports: [ProjectsService]
})

export class ProjectsModule{}
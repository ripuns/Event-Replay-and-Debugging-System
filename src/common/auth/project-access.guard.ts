import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestContext, ProjectContext,AuthenticatedUser } from './request-context';
import { ProjectsService } from '../../projects/projects.service';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
    constructor(
        private readonly projectsService: ProjectsService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context
            .switchToHttp()
            .getRequest<RequestContext>();

        const projectId = request.params.projectId;
        const user = request.user;

        if (!projectId || Array.isArray(projectId)) {
            throw new ForbiddenException('Project ID is required');
        }

        const project = await this.projectsService.requireProject(
            projectId,
            request.user.organizationId,
        );

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        if (!project) {
            throw new ForbiddenException(
                'Project does not belong to your organization',
            );
        }

        request.projectContext = {
            userId: user.userId,
            organizationId: user.organizationId,
            projectId: project.id,
        };

        return true;
    }
}
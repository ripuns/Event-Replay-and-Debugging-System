import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestContext } from './request-context';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestContext>();

    const projectId = request.params.id;
    const auth = request.auth;

    if (!projectId || Array.isArray(projectId)) {
      throw new ForbiddenException('Project ID is required');
    }

    if (!auth) {
      throw new ForbiddenException('Not authenticated');
    }

    if (auth.projectId !== projectId) {
      throw new ForbiddenException(
        'API key does not grant access to this project',
      );
    }

    return true;
  }
}

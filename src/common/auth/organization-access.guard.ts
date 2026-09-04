import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestContext } from './request-context';

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestContext>();

    const orgId = request.params.orgId;
    const auth = request.auth;

    if (!orgId || Array.isArray(orgId)) {
      throw new ForbiddenException('Organization ID is required');
    }

    if (!auth) {
      throw new ForbiddenException('Not authenticated');
    }

    if (auth.organizationId !== orgId) {
      throw new ForbiddenException(
        'API key does not grant access to this organization',
      );
    }

    return true;
  }
}

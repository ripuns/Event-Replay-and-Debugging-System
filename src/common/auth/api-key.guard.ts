import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestContext } from './request-context';
import { ApiKeyService } from '../../api-keys/api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private readonly apiKeyService: ApiKeyService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestContext>();

        const token = this.extractBearerToken(request);
        if (!token) {
            throw new UnauthorizedException('Missing or malformed Authorization header');
        }

        const verified = await this.apiKeyService.verify(token);
        if (!verified) {
            throw new UnauthorizedException('Invalid or expired API key');
        }

        request.auth = {
            projectId: verified.projectId,
            organizationId: verified.organizationId,
            apiKeyId: verified.apiKeyId,
        };

        return true;
    }

    private extractBearerToken(request: Request): string | null {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            return null;
        }

        const [type, token] = authHeader.split(' ');
        if (type !== 'Bearer' || !token) {
            return null;
        }

        return token.trim();
    }
}

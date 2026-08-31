import { Request } from 'express';

export interface AuthenticatedUser {
  userId: string;
  organizationId: string;
  role: 'admin' | 'member';
}

export interface ProjectContext {
  userId: string;
  organizationId: string;
  projectId: string;
}

export interface ApiKeyAuthContext {
  projectId: string;
  organizationId: string;
  apiKeyId: string;
}

export interface RequestContext extends Request {
  user: AuthenticatedUser;
  projectContext: ProjectContext;
  auth?: ApiKeyAuthContext;
}
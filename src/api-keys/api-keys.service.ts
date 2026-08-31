import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { ApiKeyRepository } from './api-keys.repository';

const KEY_PREFIX = 'rk_';

export interface CreatedApiKey {
  id: string;
  prefix: string;
  rawKey: string;
}

export interface VerifiedApiKey {
  apiKeyId: string;
  projectId: string;
  organizationId: string;
}

@Injectable()
export class ApiKeyService {
  constructor(private readonly apiKeyRepository: ApiKeyRepository) {}

  async create(projectId: string, name: string): Promise<CreatedApiKey> {
    const secret = randomBytes(32).toString('base64url');
    const rawKey = `${KEY_PREFIX}${secret}`;
    const keyPrefix = rawKey.slice(0, 12);
    const keyHash = this.hash(rawKey);

    const apiKey = await this.apiKeyRepository.create(
      projectId,
      name,
      keyHash,
      keyPrefix,
    );

    return { id: apiKey.id, prefix: keyPrefix, rawKey };
  }

  async verify(rawKey: string): Promise<VerifiedApiKey | null> {
    const keyHash = this.hash(rawKey);
    const apiKey = await this.apiKeyRepository.findByHash(keyHash);

    if (!apiKey) return null;
    if (apiKey.revokedAt) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    return {
      apiKeyId: apiKey.id,
      projectId: apiKey.projectId,
      organizationId: apiKey.project.organizationId,
    };
  }

  private hash(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}

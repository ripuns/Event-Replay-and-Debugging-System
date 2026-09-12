import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Response } from 'express';
import { RequestContext } from '../../common/auth/request-context';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/*
  Assigns a correlation id to every request - reused from the caller's
  header when present (so a request can be traced across
  service boundaries), otherwise generated fresh. Attached to `request` so
  any service/guard can read it for structured logging, and echoed back on
  the response so a caller can correlate their own logs with ours.
*/
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestContext, res: Response, next: NextFunction): void {
    const incoming = req.header(CORRELATION_ID_HEADER);
    const correlationId =
      incoming && incoming.trim().length > 0 ? incoming : randomUUID();

    req.correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}

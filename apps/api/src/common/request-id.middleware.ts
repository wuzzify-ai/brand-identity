import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const requestIdHeader = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const incoming = request.header(requestIdHeader);
    const requestId = incoming && incoming.trim().length > 0 ? incoming : randomUUID();

    request.requestId = requestId;
    response.setHeader(requestIdHeader, requestId);
    next();
  }
}

import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const CurrentSessionId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<Request>();

  if (!request.currentSessionId) {
    throw new Error('CurrentSessionId decorator used without CurrentUserGuard.');
  }

  return request.currentSessionId;
});

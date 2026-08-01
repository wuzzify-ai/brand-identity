import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<Request>();

  if (!request.currentUserId) {
    throw new Error('CurrentUserId decorator used without CurrentUserGuard.');
  }

  return request.currentUserId;
});

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from './domain-error';

type ValidationResponse = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = request.requestId;

    if (exception instanceof DomainError) {
      return response.status(exception.statusCode).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
          requestId
        }
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse() as string | ValidationResponse;
      const message = typeof payload === 'string' ? payload : payload.message ?? exception.message;

      return response.status(status).json({
        error: {
          code: status === HttpStatus.BAD_REQUEST ? 'VALIDATION_FAILED' : `HTTP_${status}`,
          message: Array.isArray(message) ? 'Request validation failed.' : message,
          details: Array.isArray(message) ? message : undefined,
          requestId
        }
      });
    }

    const isProduction = process.env.NODE_ENV === 'production';

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: isProduction ? 'Unexpected server error.' : String((exception as Error)?.message ?? exception),
        requestId
      }
    });
  }
}

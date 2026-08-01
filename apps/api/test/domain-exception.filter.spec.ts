import { BadRequestException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../src/common/domain-error';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter';

function createHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ requestId: 'req_123' })
    })
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('DomainExceptionFilter', () => {
  it('maps domain errors to the standard envelope', () => {
    const { host, status, json } = createHost();

    new DomainExceptionFilter().catch(new DomainError('TEST_ERROR', 'Broken', 409), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'TEST_ERROR',
        message: 'Broken',
        details: undefined,
        requestId: 'req_123'
      }
    });
  });

  it('maps validation errors without leaking stack traces', () => {
    const { host, status, json } = createHost();

    new DomainExceptionFilter().catch(new BadRequestException(['name must be set']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        details: ['name must be set'],
        requestId: 'req_123'
      }
    });
  });
});

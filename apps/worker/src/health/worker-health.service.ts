import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkerHealthService {
  status() {
    return {
      status: 'ok',
      service: 'brand-identity-worker',
      timestamp: new Date().toISOString()
    };
  }
}

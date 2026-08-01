import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

async function bootstrap() {
  const logger = new Logger('BrandIdentityWorker');
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true
  });

  app.enableShutdownHooks();
  logger.log('Worker application context started.');
}

void bootstrap();

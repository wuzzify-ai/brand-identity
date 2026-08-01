import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'path';
import { validateWorkerEnv } from './config/worker-env.schema.js';

const rootEnvPath = resolve(__dirname, '../../../.env');
const workspaceEnvPath = resolve(process.cwd(), '../../.env');
const localEnvPath = resolve(process.cwd(), '.env');
import { GenerationsWorkerModule } from './generations/generations-worker.module.js';
import { WorkerHealthService } from './health/worker-health.service.js';
import { ImageTransportModule } from './image-transport/image-transport.module.js';
import { AssetProcessingModule } from './asset-processing/asset-processing.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [workspaceEnvPath, rootEnvPath, localEnvPath],
      validate: validateWorkerEnv
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        synchronize: false,
        migrationsRun: false,
        retryAttempts: 1,
        retryDelay: 1000
      })
    }),
    GenerationsWorkerModule,
    ImageTransportModule,
    AssetProcessingModule
  ],
  providers: [WorkerHealthService]
})
export class WorkerModule {}

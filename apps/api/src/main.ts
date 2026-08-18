import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/domain-exception.filter';
import { RequestIdInterceptor } from './common/request-id.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.setGlobalPrefix('v1');
  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: true
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true }
    })
  );
  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor());

  const openApiConfig = new DocumentBuilder()
    .setTitle('Brand Identity Creator API')
    .setDescription('Versioned API for AI generated brand identities.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, openApiConfig, {
    operationIdFactory: (_controllerKey, methodKey) => methodKey
  });
  SwaggerModule.setup('docs', app, document);
  app.getHttpAdapter().get('/openapi.json', (_req, res) => res.json(document));

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();

function resolveCorsOrigin() {
  if (process.env.CORS_ALLOW_ALL === 'true') {
    return true;
  }

  return process.env.WEB_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? ['http://localhost:3000'];
}

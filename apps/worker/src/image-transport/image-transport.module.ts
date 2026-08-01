import { Module } from '@nestjs/common';
import { OpenRouterImageTransport } from './openrouter-image-transport.js';
import { PrivateObjectStorage } from './private-object-storage.js';

@Module({
  providers: [OpenRouterImageTransport, PrivateObjectStorage],
  exports: [OpenRouterImageTransport, PrivateObjectStorage]
})
export class ImageTransportModule {}

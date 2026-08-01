import { Module } from '@nestjs/common';
import { AiPolicyService } from './policies/ai-policy.service';
import { AiTransportFactory } from './transports/ai-transport.factory';
import { OpenRouterChatTransport } from './transports/openrouter-chat.transport';

@Module({
  providers: [AiPolicyService, AiTransportFactory, OpenRouterChatTransport],
  exports: [AiPolicyService, AiTransportFactory]
})
export class AiModule {}

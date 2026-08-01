import { Module } from '@nestjs/common';
import { AiPolicyResolverService } from './ai-policy-resolver.service.js';
import { OpenRouterStructuredTextService } from './openrouter-structured-text.service.js';

@Module({
  providers: [AiPolicyResolverService, OpenRouterStructuredTextService],
  exports: [AiPolicyResolverService, OpenRouterStructuredTextService]
})
export class AiWorkerModule {}

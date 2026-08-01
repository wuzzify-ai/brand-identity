import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error';
import { OpenRouterChatTransport } from './openrouter-chat.transport';
import type { AiTransport, AiTransportModality } from './ai-transport.types';

@Injectable()
export class AiTransportFactory {
  constructor(private readonly openRouterChatTransport: OpenRouterChatTransport) {}

  create(modality: AiTransportModality): AiTransport {
    if (modality === 'TEXT') {
      return this.openRouterChatTransport;
    }

    throw new DomainError('AI_TRANSPORT_UNSUPPORTED', `No AI transport registered for ${modality}.`, 400);
  }
}

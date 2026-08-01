import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WorkerAiPolicy } from './ai-policy-resolver.service.js';

export interface WorkerStructuredTextRequest {
  policy: WorkerAiPolicy;
  schemaName: string;
  userKey: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
}

export interface WorkerStructuredTextResult {
  data: unknown;
  sanitizedRequest: Record<string, unknown>;
  rawText: string;
  actualModel?: string;
  actualProvider?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

@Injectable()
export class OpenRouterStructuredTextService {
  constructor(private readonly config: ConfigService) {}

  async generate(request: WorkerStructuredTextRequest): Promise<WorkerStructuredTextResult> {
    const startedAt = Date.now();
    const primaryModel = request.policy.primary_model;
    const models = [primaryModel, ...(request.policy.fallback_models ?? [])];
    const body = {
      ...(request.policy.request_parameters ?? {}),
      model: primaryModel,
      models,
      messages: request.messages,
      stream: false,
      user: stableUserHash(request.userKey),
      provider: {
        ...(request.policy.provider_preferences ?? {}),
        require_parameters: true
      },
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: request.schemaName,
          strict: true,
          schema: request.policy.output_schema
        }
      }
    };
    const response = await fetch(`${this.config.get<string>('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.getOrThrow<string>('OPENROUTER_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(request.policy.timeout_ms)
    });
    const text = await response.text();
    const responseBody = JSON.parse(text) as {
      model?: string;
      provider?: string;
      provider_name?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(responseBody.error?.message ?? `OpenRouter request failed with ${response.status}.`);
    }

    const rawText = responseBody.choices?.[0]?.message?.content;

    if (!rawText) {
      throw new Error('OpenRouter returned an empty structured-text response.');
    }

    const result: WorkerStructuredTextResult = {
      data: JSON.parse(rawText),
      sanitizedRequest: { ...body, messages: request.messages, user: body.user },
      rawText,
      promptTokens: responseBody.usage?.prompt_tokens ?? 0,
      completionTokens: responseBody.usage?.completion_tokens ?? 0,
      totalTokens: responseBody.usage?.total_tokens ?? 0,
      latencyMs: Date.now() - startedAt
    };

    if (responseBody.model) {
      result.actualModel = responseBody.model;
    }

    const actualProvider = responseBody.provider ?? responseBody.provider_name;

    if (actualProvider) {
      result.actualProvider = actualProvider;
    }

    return result;
  }
}

function stableUserHash(userKey: string): string {
  return `u_${createHash('sha256').update(userKey).digest('hex').slice(0, 32)}`;
}

import { createHash } from 'crypto';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '../../common/domain-error';
import type {
  AiStructuredTextRequest,
  AiStructuredTextResult,
  AiTokenUsage,
  AiTransport
} from './ai-transport.types';

type FetchLike = typeof fetch;

interface OpenRouterChoice {
  message?: {
    content?: unknown;
  };
  finish_reason?: string;
  native_finish_reason?: string;
}

interface OpenRouterResponseBody {
  id?: string;
  model?: string;
  provider?: string;
  provider_name?: string;
  choices?: OpenRouterChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
}

@Injectable()
export class OpenRouterChatTransport implements AiTransport {
  private readonly fetcher: FetchLike;

  constructor(
    private readonly config: ConfigService,
    @Optional() fetcher?: FetchLike
  ) {
    this.fetcher = fetcher ?? fetch;
  }

  async generateStructuredText<TData = unknown>(
    request: AiStructuredTextRequest
  ): Promise<AiStructuredTextResult<TData>> {
    if (!request.models.length) {
      throw new DomainError('AI_MODELS_REQUIRED', 'At least one OpenRouter model is required.', 400);
    }

    const maxAttempts = request.maxAttempts ?? 2;
    const startedAt = Date.now();
    let lastError: DomainError | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.executeAttempt<TData>(request, attempt - 1, startedAt);
      } catch (error) {
        const domainError = toDomainError(error);
        lastError = domainError;

        if (!isRetryable(domainError) || attempt === maxAttempts) {
          throw domainError;
        }
      }
    }

    throw lastError ?? new DomainError('AI_PROVIDER_ERROR', 'OpenRouter request failed.', 502);
  }

  private async executeAttempt<TData>(
    request: AiStructuredTextRequest,
    retryCount: number,
    startedAt: number
  ): Promise<AiStructuredTextResult<TData>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 120_000);

    try {
      const response = await this.fetcher(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(request)),
        signal: controller.signal
      });

      const requestId = response.headers.get('x-request-id') ?? response.headers.get('x-openrouter-request-id') ?? undefined;
      const body = await parseResponseBody(response);

      if (!response.ok) {
        throw mapHttpError(response.status, body, requestId);
      }

      return this.normalizeResponse<TData>(body, requestId, Date.now() - startedAt, retryCount);
    } catch (error) {
      if (isAbortError(error)) {
        throw new DomainError('AI_TIMEOUT', 'OpenRouter request timed out.', 504, { retryable: true });
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private get baseUrl(): string {
    return this.config.get<string>('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1';
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.getOrThrow<string>('OPENROUTER_API_KEY')}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:4000',
      'X-OpenRouter-Title': 'Wuzzify Brand Identity'
    };
  }

  private buildBody(request: AiStructuredTextRequest): Record<string, unknown> {
    const provider = {
      ...(request.providerPreferences ?? {}),
      require_parameters: true
    };

    return {
      ...(request.requestParameters ?? {}),
      model: request.models[0],
      models: request.models,
      messages: request.messages,
      stream: false,
      user: stableUserHash(request.userKey),
      provider,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: request.schemaName,
          strict: true,
          schema: request.outputSchema
        }
      }
    };
  }

  private normalizeResponse<TData>(
    body: OpenRouterResponseBody,
    requestId: string | undefined,
    latencyMs: number,
    retryCount: number
  ): AiStructuredTextResult<TData> {
    const choice = body.choices?.[0];

    if (!choice) {
      throw new DomainError('AI_EMPTY_RESPONSE', 'OpenRouter returned no choices.', 502, { retryable: true });
    }

    if (choice.finish_reason === 'content_filter') {
      throw new DomainError('AI_CONTENT_FILTER', 'The AI provider blocked the response for safety.', 422, {
        retryable: false,
        requestId
      });
    }

    const rawText = extractText(choice.message?.content);

    try {
      const result: AiStructuredTextResult<TData> = {
        data: JSON.parse(rawText) as TData,
        rawText,
        usage: normalizeUsage(body.usage),
        latencyMs,
        retryCount
      };

      const normalizedRequestId = requestId ?? body.id;
      const normalizedProvider = body.provider ?? body.provider_name;

      if (normalizedRequestId) {
        result.requestId = normalizedRequestId;
      }
      if (body.model) {
        result.model = body.model;
      }
      if (normalizedProvider) {
        result.provider = normalizedProvider;
      }
      if (choice.finish_reason) {
        result.finishReason = choice.finish_reason;
      }
      if (choice.native_finish_reason) {
        result.nativeFinishReason = choice.native_finish_reason;
      }

      return result;
    } catch {
      throw new DomainError('AI_RESPONSE_JSON_INVALID', 'OpenRouter returned malformed JSON.', 502, {
        retryable: false,
        requestId,
        model: body.model
      });
    }
  }
}

function stableUserHash(userKey: string): string {
  return `u_${createHash('sha256').update(userKey).digest('hex').slice(0, 32)}`;
}

async function parseResponseBody(response: Response): Promise<OpenRouterResponseBody> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as OpenRouterResponseBody;
  } catch {
    throw new DomainError('AI_UPSTREAM_MALFORMED_RESPONSE', 'OpenRouter returned invalid response JSON.', 502, {
      retryable: true
    });
  }
}

function mapHttpError(status: number, body: OpenRouterResponseBody, requestId?: string): DomainError {
  const message = body.error?.message ?? 'OpenRouter request failed.';
  const details = { retryable: status === 429 || status >= 500, requestId, upstreamCode: body.error?.code };

  if (status === 429) {
    return new DomainError('AI_RATE_LIMIT', message, 429, details);
  }

  if (status === 401 || status === 403) {
    return new DomainError('AI_UPSTREAM_AUTH', message, 502, { ...details, retryable: false });
  }

  if (status >= 500) {
    return new DomainError('AI_PROVIDER_ERROR', message, 502, details);
  }

  return new DomainError('AI_UPSTREAM_REJECTED', message, 422, { ...details, retryable: false });
}

function normalizeUsage(usage: OpenRouterResponseBody['usage']): AiTokenUsage {
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0
  };
}

function extractText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'object' && part && 'text' in part) {
          return String(part.text);
        }

        return '';
      })
      .join('');
  }

  throw new DomainError('AI_EMPTY_RESPONSE', 'OpenRouter returned no message content.', 502, { retryable: true });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function toDomainError(error: unknown): DomainError {
  if (error instanceof DomainError) {
    return error;
  }

  return new DomainError('AI_TRANSPORT_ERROR', 'OpenRouter transport failed.', 502, { retryable: true });
}

function isRetryable(error: DomainError): boolean {
  return Boolean((error.details as { retryable?: boolean } | undefined)?.retryable);
}

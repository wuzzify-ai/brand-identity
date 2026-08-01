export type AiTransportModality = 'TEXT' | 'IMAGE';

export type AiChatRole = 'system' | 'user' | 'assistant';

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export interface AiStructuredTextRequest {
  task: string;
  schemaName: string;
  outputSchema: Record<string, unknown>;
  messages: AiChatMessage[];
  models: string[];
  providerPreferences?: Record<string, unknown>;
  requestParameters?: Record<string, unknown>;
  userKey: string;
  timeoutMs?: number;
  maxAttempts?: number;
}

export interface AiTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiStructuredTextResult<TData = unknown> {
  data: TData;
  rawText: string;
  requestId?: string;
  model?: string;
  provider?: string;
  finishReason?: string;
  nativeFinishReason?: string;
  usage: AiTokenUsage;
  latencyMs: number;
  retryCount: number;
}

export interface AiTransport {
  generateStructuredText<TData = unknown>(
    request: AiStructuredTextRequest
  ): Promise<AiStructuredTextResult<TData>>;
}

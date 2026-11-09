// Zealosh LMS — AI Provider Adapter & Health Service
// Governs provider abstraction for Zealosh AI (Ollama Local Inference on Server 3)
// Strictly enforces honest unconfigured status without simulated realism or fake inference badges

import { AiServiceHealth, AiProviderStatus } from '@/types';

export class ZealoshAiProviderAdapter {
  private baseUrl: string;
  private model: string;
  private timeoutMs: number;

  constructor() {
    this.baseUrl = (process.env.OLLAMA_BASE_URL || '').trim();
    this.model = (process.env.OLLAMA_MODEL || 'llama3:8b').trim();
    this.timeoutMs = parseInt(process.env.AI_INFERENCE_TIMEOUT_MS || '15000', 10);
  }

  /**
   * Checks whether the AI provider is configured and reachable.
   * Returns honest UNCONFIGURED status when OLLAMA_BASE_URL is not set.
   */
  public async getServiceHealth(): Promise<AiServiceHealth> {
    if (!this.baseUrl) {
      return {
        status: 'UNCONFIGURED',
        provider: 'Zealosh AI (Ollama Local Inference)',
        model: 'unconfigured',
        isAvailable: false,
        message: 'AI inference server (Server 3) is unconfigured. Provider deployment is gated pending dedicated VPS activation.',
      };
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timer);

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          status: 'DEGRADED',
          provider: 'Zealosh AI (Ollama Local Inference)',
          model: this.model,
          isAvailable: false,
          latencyMs,
          message: `AI provider HTTP error: status ${res.status}`,
        };
      }

      return {
        status: 'CONFIGURED',
        provider: 'Zealosh AI (Ollama Local Inference)',
        model: this.model,
        isAvailable: true,
        latencyMs,
      };
    } catch (err: any) {
      return {
        status: 'DOWN',
        provider: 'Zealosh AI (Ollama Local Inference)',
        model: this.model,
        isAvailable: false,
        latencyMs: Date.now() - start,
        message: `Connection failed: ${err.message}`,
      };
    }
  }

  /**
   * Generates a grounded inference completion.
   * Throws an explicit error if the provider is unconfigured.
   */
  public async generateCompletion(params: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
  }): Promise<{ responseText: string; modelUsed: string }> {
    if (!this.baseUrl) {
      throw new Error(
        'AI_PROVIDER_UNCONFIGURED: Zealosh AI inference provider is not configured. Server 3 VPS deployment is required for live inference.'
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          system: params.systemPrompt,
          prompt: params.userPrompt,
          stream: false,
          options: {
            temperature: params.temperature ?? 0.2, // Conservative temperature for factual grounding
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`AI_INFERENCE_ERROR: Upstream model server responded with HTTP ${res.status}`);
      }

      const data = await res.json();
      return {
        responseText: data.response || '',
        modelUsed: this.model,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`AI_TIMEOUT: Upstream model inference timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const aiProviderAdapter = new ZealoshAiProviderAdapter();


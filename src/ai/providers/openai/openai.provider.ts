import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { ConfigService } from '../../../config/config.service';

interface OpenAiResponseContent {
  type?: string;
  text?: string;
}

interface OpenAiResponseOutput {
  content?: OpenAiResponseContent[];
}

interface OpenAiResponsePayload {
  output_text?: string;
  output?: OpenAiResponseOutput[];
}

@Injectable()
export class OpenAiProvider {
  private readonly http: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.http = axios.create({
      baseURL: 'https://api.openai.com/v1',
      timeout: 30000,
    });
  }

  async createJsonResponse(prompt: string, model: string): Promise<unknown> {
    const { apiKey } = this.configService.getOpenAiEpicNormalizerConfig();

    const response = await this.http.post<OpenAiResponsePayload>(
      '/responses',
      {
        model,
        input: prompt,
        text: {
          format: {
            type: 'json_object',
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const outputText = this.extractOutputText(response.data);

    try {
      return JSON.parse(outputText);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown JSON parse error';
      this.logger.error(
        `OpenAI response was not valid JSON: ${message}`,
        undefined,
        'Normalize',
      );
      throw new Error('OpenAI response was not valid JSON.');
    }
  }

  private extractOutputText(payload: OpenAiResponsePayload): string {
    if (payload.output_text && payload.output_text.trim().length > 0) {
      return payload.output_text.trim();
    }

    const texts =
      payload.output
        ?.flatMap((item) => item.content ?? [])
        .filter((content) => content.type === 'output_text' && content.text)
        .map((content) => content.text?.trim() ?? '')
        .filter((text) => text.length > 0) ?? [];

    if (texts.length > 0) {
      return texts.join('\n');
    }

    throw new Error('OpenAI response did not contain output text.');
  }
}

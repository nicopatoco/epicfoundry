import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';

dotenv.config({ quiet: true });

@Injectable()
export class ConfigService {
  get(key: string): string | undefined {
    return process.env[key];
  }

  getOrThrow(key: string): string {
    const value = this.get(key);

    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
  }

  getTrelloConfig(): {
    apiKey: string;
    token: string;
    boardId: string;
  } {
    return {
      apiKey: this.getOrThrow('TRELLO_API_KEY'),
      token: this.getOrThrow('TRELLO_TOKEN'),
      boardId: this.getOrThrow('TRELLO_BOARD_ID'),
    };
  }

  getOpenAiEpicNormalizerConfig(): {
    apiKey: string;
    model: string;
  } {
    const model = this.get('OPENAI_MODEL_EPIC_NORMALIZER')?.trim() || 'gpt-5.3-codex';

    return {
      apiKey: this.getOrThrow('OPENAI_API_KEY'),
      model,
    };
  }
}

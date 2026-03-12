import { Injectable } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { ConfigService } from '../config/config.service';
import { AppLogger } from '../common/logger/app-logger.service';

export interface TrelloList {
  id: string;
  name: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idList: string;
}

@Injectable()
export class TrelloService {
  private readonly http: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.http = axios.create({
      baseURL: 'https://api.trello.com/1',
      timeout: 10000,
    });
  }

  async getBoardLists(): Promise<TrelloList[]> {
    try {
      const { boardId } = this.configService.getTrelloConfig();
      const response = await this.http.get<TrelloList[]>(`/boards/${boardId}/lists`, {
        params: this.authParams,
      });

      return response.data;
    } catch (error) {
      this.handleError('Failed to fetch board lists', error);
      return [];
    }
  }

  async getCardsByListName(listName: string): Promise<TrelloCard[]> {
    const list = await this.findListByName(listName);

    if (!list) {
      this.logger.warn(`List not found: ${listName}`, 'TrelloService');
      return [];
    }

    try {
      const response = await this.http.get<TrelloCard[]>(`/lists/${list.id}/cards`, {
        params: this.authParams,
      });

      return response.data;
    } catch (error) {
      this.handleError(`Failed to fetch cards for list ${listName}`, error);
      return [];
    }
  }

  async getEpicCards(): Promise<TrelloCard[]> {
    try {
      const { boardId } = this.configService.getTrelloConfig();
      const response = await this.http.get<TrelloCard[]>(`/boards/${boardId}/cards`, {
        params: this.authParams,
      });

      return response.data.filter((card) =>
        card.name.trim().toUpperCase().startsWith('EPIC:'),
      );
    } catch (error) {
      this.handleError('Failed to fetch epic cards', error);
      return [];
    }
  }

  async getTodoCards(): Promise<TrelloCard[]> {
    return this.getCardsByListName('Todo');
  }

  async moveCardToList(cardId: string, listName: string): Promise<boolean> {
    const list = await this.findListByName(listName);

    if (!list) {
      this.logger.warn(`Cannot move card. List not found: ${listName}`, 'TrelloService');
      return false;
    }

    try {
      await this.http.put(
        `/cards/${cardId}`,
        {},
        {
          params: {
            ...this.authParams,
            idList: list.id,
          },
        },
      );

      this.logger.log(`Card ${cardId} moved to ${listName}`, 'TrelloService');
      return true;
    } catch (error) {
      this.handleError(`Failed to move card ${cardId} to ${listName}`, error);
      return false;
    }
  }

  async addCommentToCard(cardId: string, text: string): Promise<boolean> {
    try {
      await this.http.post(
        `/cards/${cardId}/actions/comments`,
        {},
        {
          params: {
            ...this.authParams,
            text,
          },
        },
      );

      return true;
    } catch (error) {
      this.handleError(`Failed to add comment to card ${cardId}`, error);
      return false;
    }
  }

  private get authParams(): { key: string; token: string } {
    const { apiKey, token } = this.configService.getTrelloConfig();

    return {
      key: apiKey,
      token,
    };
  }

  private async findListByName(listName: string): Promise<TrelloList | undefined> {
    const lists = await this.getBoardLists();

    return lists.find(
      (list) => list.name.trim().toLowerCase() === listName.trim().toLowerCase(),
    );
  }

  private handleError(message: string, error: unknown): void {
    if (error instanceof AxiosError) {
      const details = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      this.logger.error(`${message}: ${details}`, error.stack, 'TrelloService');
      return;
    }

    if (error instanceof Error) {
      this.logger.error(`${message}: ${error.message}`, error.stack, 'TrelloService');
      return;
    }

    this.logger.error(message, undefined, 'TrelloService');
  }
}

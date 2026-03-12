import { Injectable } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { AppLogger } from '../common/logger/app-logger.service';
import { ConfigService } from '../config/config.service';
import {
  EnsureListsResult,
  TrelloBoard,
  TrelloCard,
  TrelloCommentAction,
  TrelloList,
} from './trello.types';

export type { EnsureListsResult, TrelloBoard, TrelloCard, TrelloList } from './trello.types';

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

  async validateBoardAccess(): Promise<boolean> {
    try {
      await this.getBoard();
      return true;
    } catch (error) {
      this.handleError('Failed to validate board access', error);
      return false;
    }
  }

  async getBoard(): Promise<TrelloBoard> {
    const { boardId } = this.configService.getTrelloConfig();

    try {
      return await this.get<TrelloBoard>(`/boards/${boardId}`, {
        fields: 'id,name,url',
      });
    } catch (error) {
      this.throwError('Failed to fetch board', error);
    }
  }

  async getLists(): Promise<TrelloList[]> {
    const { boardId } = this.configService.getTrelloConfig();

    try {
      return await this.get<TrelloList[]>(`/boards/${boardId}/lists`, {
        fields: 'id,name,pos',
      });
    } catch (error) {
      this.throwError('Failed to fetch board lists', error);
    }
  }

  async ensureLists(listNames: string[]): Promise<EnsureListsResult> {
    const existingLists = await this.getLists();
    const existingByName = new Map(
      existingLists.map((list) => [list.name.trim().toLowerCase(), list]),
    );

    const created: TrelloList[] = [];

    for (const listName of listNames) {
      const normalized = listName.trim().toLowerCase();
      if (existingByName.has(normalized)) {
        continue;
      }

      const newList = await this.createList(listName);
      created.push(newList);
      existingByName.set(normalized, newList);
    }

    return {
      existing: existingLists,
      created,
      all: [...existingByName.values()],
    };
  }

  async getCardsInList(listId: string): Promise<TrelloCard[]> {
    try {
      return await this.get<TrelloCard[]>(`/lists/${listId}/cards`, {
        fields: 'id,name,desc,idList',
      });
    } catch (error) {
      this.throwError(`Failed to fetch cards for list id ${listId}`, error);
    }
  }

  async getEpics(): Promise<TrelloCard[]> {
    const cards = await this.getCardsInListByName('Epic');

    return cards.filter((card) =>
      card.name.trim().toUpperCase().startsWith('EPIC:'),
    );
  }

  async createCard(listId: string, name: string, desc = ''): Promise<TrelloCard> {
    try {
      return await this.post<TrelloCard>('/cards', {
        idList: listId,
        name,
        desc,
      });
    } catch (error) {
      this.throwError(`Failed to create card: ${name}`, error);
    }
  }

  async moveCard(cardId: string, listId: string): Promise<void> {
    try {
      await this.put(`/cards/${cardId}`, {
        idList: listId,
      });
    } catch (error) {
      this.throwError(`Failed to move card ${cardId}`, error);
    }
  }

  async addComment(cardId: string, text: string): Promise<void> {
    try {
      await this.post(`/cards/${cardId}/actions/comments`, {
        text,
      });
    } catch (error) {
      this.throwError(`Failed to add comment to card ${cardId}`, error);
    }
  }

  async deleteCard(cardId: string): Promise<void> {
    try {
      await this.delete(`/cards/${cardId}`);
    } catch (error) {
      this.throwError(`Failed to delete card ${cardId}`, error);
    }
  }

  async getCardComments(cardId: string): Promise<string[]> {
    try {
      const actions = await this.get<TrelloCommentAction[]>(
        `/cards/${cardId}/actions`,
        {
          filter: 'commentCard',
          fields: 'data,type',
          limit: 1000,
        },
      );

      return actions
        .filter((action) => action.type === 'commentCard')
        .map((action) => action.data?.text?.trim() ?? '')
        .filter((text) => text.length > 0);
    } catch (error) {
      this.throwError(`Failed to fetch comments for card ${cardId}`, error);
    }
  }

  async getListByName(listName: string): Promise<TrelloList | undefined> {
    const lists = await this.getLists();

    return lists.find(
      (list) => list.name.trim().toLowerCase() === listName.trim().toLowerCase(),
    );
  }

  async getTodoCards(): Promise<TrelloCard[]> {
    try {
      return await this.getCardsInListByName('Todo');
    } catch (error) {
      this.handleError('Failed to fetch Todo cards', error);
      return [];
    }
  }

  async moveCardToList(cardId: string, listName: string): Promise<boolean> {
    try {
      const list = await this.getListByName(listName);

      if (!list) {
        this.logger.warn(`Cannot move card. List not found: ${listName}`, 'Trello');
        return false;
      }

      await this.moveCard(cardId, list.id);
      this.logger.log(`Card ${cardId} moved to ${listName}`, 'Trello');
      return true;
    } catch (error) {
      this.handleError(`Failed to move card ${cardId} to ${listName}`, error);
      return false;
    }
  }

  async addCommentToCard(cardId: string, text: string): Promise<boolean> {
    try {
      await this.addComment(cardId, text);
      return true;
    } catch (error) {
      this.handleError(`Failed to add comment to card ${cardId}`, error);
      return false;
    }
  }

  private async createList(name: string): Promise<TrelloList> {
    const { boardId } = this.configService.getTrelloConfig();

    try {
      return await this.post<TrelloList>(`/boards/${boardId}/lists`, {
        name,
        pos: 'bottom',
      });
    } catch (error) {
      this.throwError(`Failed to create list: ${name}`, error);
    }
  }

  private async getCardsInListByName(listName: string): Promise<TrelloCard[]> {
    const list = await this.getListByName(listName);

    if (!list) {
      throw new Error(`Trello list not found: ${listName}`);
    }

    return this.getCardsInList(list.id);
  }

  private get authParams(): { key: string; token: string } {
    const { apiKey, token } = this.configService.getTrelloConfig();

    return {
      key: apiKey,
      token,
    };
  }

  private async get<T>(url: string, params: Record<string, unknown> = {}): Promise<T> {
    const response = await this.http.get<T>(url, {
      params: {
        ...this.authParams,
        ...params,
      },
    });

    return response.data;
  }

  private async post<T = void>(
    url: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const response = await this.http.post<T>(url, null, {
      params: {
        ...this.authParams,
        ...params,
      },
    });

    return response.data;
  }

  private async put(url: string, params: Record<string, unknown>): Promise<void> {
    await this.http.put(url, null, {
      params: {
        ...this.authParams,
        ...params,
      },
    });
  }

  private async delete(url: string): Promise<void> {
    await this.http.delete(url, {
      params: this.authParams,
    });
  }

  private throwError(message: string, error: unknown): never {
    if (error instanceof AxiosError) {
      const details = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      throw new Error(`${message}: ${details}`);
    }

    if (error instanceof Error) {
      throw new Error(`${message}: ${error.message}`);
    }

    throw new Error(message);
  }

  private handleError(message: string, error: unknown): void {
    if (error instanceof Error) {
      this.logger.error(`${message}: ${error.message}`, error.stack, 'Trello');
      return;
    }

    this.logger.error(message, undefined, 'Trello');
  }
}

export interface TrelloBoard {
  id: string;
  name: string;
  url?: string;
}

export interface TrelloList {
  id: string;
  name: string;
  pos?: number | string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idList: string;
}

export interface TrelloCommentAction {
  id: string;
  type: string;
  data?: {
    text?: string;
  };
}

export interface EnsureListsResult {
  existing: TrelloList[];
  created: TrelloList[];
  all: TrelloList[];
}

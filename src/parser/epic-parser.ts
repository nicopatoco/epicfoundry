import { Injectable } from '@nestjs/common';
import { Epic } from '../models/epic';
import { EpicNormalizerService } from './epic-normalizer.service';

@Injectable()
export class EpicParser {
  constructor(private readonly epicNormalizer: EpicNormalizerService) {}

  parseFromCard(cardName: string, description = ''): Epic | null {
    if (!cardName.trim().toUpperCase().startsWith('EPIC:')) {
      return null;
    }

    return this.epicNormalizer.normalizeEpic({
      name: cardName,
      desc: description,
    });
  }
}

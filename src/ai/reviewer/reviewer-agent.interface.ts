import { ReviewInput, ReviewResult } from '../ai.types';

export interface ReviewerAgent {
  review(input: ReviewInput): Promise<ReviewResult>;
}

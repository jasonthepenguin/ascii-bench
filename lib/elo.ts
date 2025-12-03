/**
 * ELO Rating System Utilities
 *
 * This module implements the ELO rating calculations used for ranking
 * AI models based on community votes on their ASCII art outputs.
 *
 * The system uses a dynamic K-factor that decreases as models accumulate
 * more votes, making established models more stable while allowing new
 * models to move quickly in the rankings.
 */

// Constants matching the PostgreSQL implementation
const BASE_K = 32.0; // Starting K-factor for new models
const MIN_K = 10.0; // Minimum K-factor for established models
const DECAY_DIVISOR = 30.0; // Controls how quickly K decreases

/**
 * Calculates the dynamic K-factor based on a model's vote count.
 *
 * Higher K-factor means ratings change more dramatically per vote.
 * New models start with K=32 for fast initial placement, decaying
 * toward K=10 as they accumulate votes for more stable rankings.
 *
 * Formula: K = max(BASE_K / (1 + voteCount / DECAY_DIVISOR), MIN_K)
 *
 * @param voteCount - Number of votes the model has received
 * @returns K-factor between MIN_K (10) and BASE_K (32)
 */
export function calculateKFactor(voteCount: number): number {
  const kFactor = BASE_K / (1.0 + voteCount / DECAY_DIVISOR);
  return Math.max(kFactor, MIN_K);
}

/**
 * Calculates the expected score (probability of winning) for a player
 * against an opponent using the standard ELO formula.
 *
 * Formula: E = 1 / (1 + 10^((opponentElo - playerElo) / 400))
 *
 * @param playerElo - ELO rating of the player
 * @param opponentElo - ELO rating of the opponent
 * @returns Expected score between 0 and 1 (probability of winning)
 */
export function calculateExpectedScore(
  playerElo: number,
  opponentElo: number
): number {
  return 1.0 / (1.0 + Math.pow(10.0, (opponentElo - playerElo) / 400.0));
}

/**
 * Calculates the new ELO ratings for both winner and loser after a match.
 *
 * Uses dynamic K-factors based on each model's vote count, allowing
 * new models to move quickly while established models remain stable.
 *
 * @param winnerElo - Current ELO rating of the winner
 * @param loserElo - Current ELO rating of the loser
 * @param winnerVoteCount - Number of votes the winner has received
 * @param loserVoteCount - Number of votes the loser has received
 * @returns Object containing new ratings for both winner and loser
 */
export function calculateNewRatings(
  winnerElo: number,
  loserElo: number,
  winnerVoteCount: number,
  loserVoteCount: number
): { winnerNewElo: number; loserNewElo: number } {
  // Calculate dynamic K-factors
  const winnerK = calculateKFactor(winnerVoteCount);
  const loserK = calculateKFactor(loserVoteCount);

  // Calculate expected scores
  const expectedWinner = calculateExpectedScore(winnerElo, loserElo);
  const expectedLoser = calculateExpectedScore(loserElo, winnerElo);

  // Calculate new ratings
  // Winner: actual score = 1 (won)
  // Loser: actual score = 0 (lost)
  const winnerNewElo = Math.round(winnerElo + winnerK * (1.0 - expectedWinner));
  const loserNewElo = Math.round(loserElo + loserK * (0.0 - expectedLoser));

  return { winnerNewElo, loserNewElo };
}

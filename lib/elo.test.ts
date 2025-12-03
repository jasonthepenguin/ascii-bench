import { describe, it, expect } from 'vitest';
import {
  calculateKFactor,
  calculateExpectedScore,
  calculateNewRatings,
} from './elo';

describe('calculateKFactor', () => {
  it('returns maximum K (32) for a new model with 0 votes', () => {
    expect(calculateKFactor(0)).toBe(32);
  });

  it('returns K=16 for a model with 30 votes', () => {
    // K = 32 / (1 + 30/30) = 32 / 2 = 16
    expect(calculateKFactor(30)).toBe(16);
  });

  it('returns K close to minimum for established models (100+ votes)', () => {
    // K = 32 / (1 + 100/30) = 32 / 4.33 ≈ 7.38, but min is 10
    expect(calculateKFactor(100)).toBe(10);
  });

  it('never goes below minimum K (10)', () => {
    expect(calculateKFactor(500)).toBe(10);
    expect(calculateKFactor(1000)).toBe(10);
  });

  it('decreases gradually as vote count increases', () => {
    const k0 = calculateKFactor(0);
    const k10 = calculateKFactor(10);
    const k20 = calculateKFactor(20);
    const k50 = calculateKFactor(50);

    expect(k0).toBeGreaterThan(k10);
    expect(k10).toBeGreaterThan(k20);
    expect(k20).toBeGreaterThan(k50);
  });
});

describe('calculateExpectedScore', () => {
  it('returns 0.5 for equal ratings', () => {
    expect(calculateExpectedScore(1500, 1500)).toBe(0.5);
    expect(calculateExpectedScore(1200, 1200)).toBe(0.5);
  });

  it('returns ~0.91 for 400 point advantage', () => {
    const expected = calculateExpectedScore(1500, 1100);
    // E = 1 / (1 + 10^(-400/400)) = 1 / (1 + 0.1) ≈ 0.909
    expect(expected).toBeCloseTo(0.909, 2);
  });

  it('returns ~0.09 for 400 point disadvantage', () => {
    const expected = calculateExpectedScore(1100, 1500);
    expect(expected).toBeCloseTo(0.091, 2);
  });

  it('returns higher expected score for higher rated player', () => {
    const favorite = calculateExpectedScore(1600, 1400);
    const underdog = calculateExpectedScore(1400, 1600);

    expect(favorite).toBeGreaterThan(0.5);
    expect(underdog).toBeLessThan(0.5);
    // Expected scores should sum to 1
    expect(favorite + underdog).toBeCloseTo(1.0, 10);
  });

  it('expected scores always sum to 1', () => {
    const playerA = calculateExpectedScore(1500, 1300);
    const playerB = calculateExpectedScore(1300, 1500);
    expect(playerA + playerB).toBeCloseTo(1.0, 10);
  });
});

describe('calculateNewRatings', () => {
  it('awards ~16 points each when equal new models play', () => {
    const { winnerNewElo, loserNewElo } = calculateNewRatings(
      1500,
      1500,
      0,
      0
    );
    // K=32, expected=0.5, change = 32 * 0.5 = 16
    expect(winnerNewElo).toBe(1516);
    expect(loserNewElo).toBe(1484);
  });

  it('awards fewer points when established models play', () => {
    const newModels = calculateNewRatings(1500, 1500, 0, 0);
    const establishedModels = calculateNewRatings(1500, 1500, 100, 100);

    const newGain = newModels.winnerNewElo - 1500;
    const establishedGain = establishedModels.winnerNewElo - 1500;

    expect(establishedGain).toBeLessThan(newGain);
  });

  it('gives bigger swing when underdog wins', () => {
    // Underdog (1300) beats favorite (1700)
    const upset = calculateNewRatings(1300, 1700, 0, 0);
    // Favorite (1700) beats underdog (1300)
    const expected = calculateNewRatings(1700, 1300, 0, 0);

    const upsetGain = upset.winnerNewElo - 1300;
    const expectedGain = expected.winnerNewElo - 1700;

    // Upset winner should gain more than expected winner
    expect(upsetGain).toBeGreaterThan(expectedGain);
  });

  it('preserves total ELO when K-factors are equal', () => {
    // When both models have same vote count (same K), total ELO is preserved
    const { winnerNewElo, loserNewElo } = calculateNewRatings(
      1500,
      1500,
      50,
      50
    );
    expect(winnerNewElo + loserNewElo).toBe(3000);
  });

  it('handles asymmetric K-factors correctly', () => {
    // New model (K=32) beats established model (K=10)
    const { winnerNewElo, loserNewElo } = calculateNewRatings(
      1500,
      1500,
      0, // new model (K=32)
      100 // established model (K=10)
    );

    // Winner gains more (K=32) than loser loses (K=10)
    const winnerGain = winnerNewElo - 1500;
    const loserLoss = 1500 - loserNewElo;

    expect(winnerGain).toBeGreaterThan(loserLoss);
  });

  it('returns integers (rounded ratings)', () => {
    const { winnerNewElo, loserNewElo } = calculateNewRatings(
      1537,
      1423,
      17,
      42
    );

    expect(Number.isInteger(winnerNewElo)).toBe(true);
    expect(Number.isInteger(loserNewElo)).toBe(true);
  });
});

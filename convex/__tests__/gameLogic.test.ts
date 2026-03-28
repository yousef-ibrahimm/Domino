import { describe, it, expect } from "vitest";
import {
  shuffleTiles,
  dealHands,
  findDoubleSixHolder,
  tileMatchesEnd,
  hasPlayableMove,
  pipCount,
  resolveBlock,
  calculateDominoPoints,
  tilesEqual,
} from "../gameLogic";
import { ALL_TILES } from "../types";

describe("domino gameLogic", () => {
  it("shuffleTiles works deterministically with seeds", () => {
    const s1 = shuffleTiles(12345);
    const s2 = shuffleTiles(12345);
    const s3 = shuffleTiles(67890);
    
    expect(s1).toHaveLength(28);
    expect(s1).toEqual(s2);
    expect(s1).not.toEqual(s3);
  });

  it("dealHands creates 4 hands of 7 tiles", () => {
    const s1 = shuffleTiles(Date.now());
    const hands = dealHands(s1);
    expect(hands).toHaveLength(4);
    hands.forEach(h => expect(h).toHaveLength(7));
  });

  it("findDoubleSixHolder finds correct seat", () => {
    const mockHands = [
      [{high: 1, low: 1}, {high: 2, low: 2}],
      [{high: 3, low: 1}],
      [{high: 6, low: 6}], // Seat 2 has double six
      [{high: 5, low: 4}]
    ] as any;
    expect(findDoubleSixHolder(mockHands)).toBe(2);
  });

  it("tileMatchesEnd validates correctly", () => {
    expect(tileMatchesEnd({high: 5, low: 3}, 5)).toBe(true);
    expect(tileMatchesEnd({high: 5, low: 3}, 3)).toBe(true);
    expect(tileMatchesEnd({high: 5, low: 3}, 1)).toBe(false);
  });

  it("hasPlayableMove correctly flags available moves", () => {
    const hand = [{high: 5, low: 3}, {high: 2, low: 2}];
    expect(hasPlayableMove(hand, [5, 1])).toBe(true);
    expect(hasPlayableMove(hand, [3, 4])).toBe(true);
    expect(hasPlayableMove(hand, [6, 1])).toBe(false);
  });

  it("pipCount sums hands correctly", () => {
    const hand = [{high: 5, low: 3}, {high: 2, low: 2}, {high: 1, low: 0}];
    expect(pipCount(hand)).toBe(8 + 4 + 1);
  });

  it("resolveBlock finds lowest score or draw", () => {
    const drawHands = [
      [{high: 1, low: 1}], // 2
      [{high: 2, low: 0}], // 2 -> Draw!
      [{high: 5, low: 5}], // 10
      [{high: 6, low: 6}]  // 12
    ] as any;
    expect(resolveBlock(drawHands)).toBeNull();

    const winHands = [
      [{high: 1, low: 1}], // 2
      [{high: 3, low: 0}], // 3
      [{high: 5, low: 5}], // 10
      [{high: 6, low: 6}]  // 12
    ] as any;
    const res = resolveBlock(winHands);
    expect(res).not.toBeNull();
    expect(res?.winningSeat).toBe(0);
    expect(res?.points).toBe(3 + 10 + 12);
  });

  it("calculateDominoPoints ignores the winning seat", () => {
    const hands = [
      [], // Seat 0 won
      [{high: 1, low: 1}], // 2
      [{high: 2, low: 2}], // 4
      [{high: 3, low: 3}]  // 6
    ] as any;
    expect(calculateDominoPoints(hands, 0)).toBe(12);
  });
});

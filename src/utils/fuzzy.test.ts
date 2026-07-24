import { describe, expect, it } from "vitest";
import { getSearchScore } from "./fuzzy";

describe("getSearchScore", () => {
  it("matches exact terms strongly", () => {
    const score = getSearchScore("one kiss", "one kiss dua lipa");
    expect(score).toBeGreaterThan(200);
  });

  it("matches with typo tolerance", () => {
    const score = getSearchScore("supr freaky", "super freaky girl nicki minaj");
    expect(score).toBeGreaterThan(0);
  });

  it("returns negative for non-match", () => {
    const score = getSearchScore("classical symphony", "metallica sandman");
    expect(score).toBeLessThan(0);
  });
});

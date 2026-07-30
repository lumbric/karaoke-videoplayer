import { describe, expect, it } from "vitest";
import { getSearchScore } from "./fuzzy";

describe("getSearchScore", () => {
  it("matches exact terms strongly", () => {
    const score = getSearchScore("one kiss", "one kiss dua lipa");
    expect(score).toBeGreaterThan(200);
  });

  it("matches words in any order", () => {
    const score = getSearchScore("hello world", "world hello");
    expect(score).toBeGreaterThan(200);
  });

  it("matches with typo tolerance", () => {
    const score = getSearchScore("supr freaky", "super freaky");
    expect(score).toBeGreaterThan(0);
  });

  it("requires every query word to match", () => {
    const score = getSearchScore("hello world", "hello");
    expect(score).toBeLessThan(0);
  });

  it("returns negative for non-match", () => {
    const score = getSearchScore("classical symphony", "metallica sandman");
    expect(score).toBeLessThan(0);
  });

  it("matches transliterated greek query and candidate", () => {
    const score = getSearchScore("athina", "Αθήνα");
    expect(score).toBeGreaterThan(0);
  });

  it("matches transliterated greek candidate from greek query", () => {
    const score = getSearchScore("Αθήνα", "athina");
    expect(score).toBeGreaterThan(0);
  });

  it("matches close german umlaut typo", () => {
    const score = getSearchScore("ärte", "ärzte");
    expect(score).toBeGreaterThan(0);
  });

  it("matches when 2nd query word has 1 character", () => {
    const score = getSearchScore("hello a", "hello alice");
    expect(score).toBeGreaterThan(0);
  });

  it("matches when 2nd query word has 2 characters", () => {
    const score = getSearchScore("hello in", "hello inside");
    expect(score).toBeGreaterThan(0);
  });

  it("filters results when adding a short 2nd word", () => {
    const scoreWith = getSearchScore("hello in", "hello inside");
    const scoreWithout = getSearchScore("hello", "hello inside");
    expect(scoreWith).toBeGreaterThan(0);
    expect(scoreWithout).toBeGreaterThan(0);
  });

  it("matches when nth query word has 2 characters", () => {
    const score = getSearchScore("super d", "super dude");
    expect(score).toBeGreaterThan(0);
  });

  it("does not match short query word against unrelated candidate", () => {
    const score = getSearchScore("hello xy", "hello world");
    expect(score).toBeLessThan(0);
  });
});

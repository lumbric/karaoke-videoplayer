import { describe, expect, it } from "vitest";
import { normalizeForSearch } from "./normalize";

describe("normalizeForSearch", () => {
  it("normalizes punctuation and case", () => {
    expect(normalizeForSearch("5/8 in Ehren!")).toBe("5 8 in ehren");
  });

  it("transliterates greek", () => {
    expect(normalizeForSearch("Αθήνα")).toBe("athina");
  });

  it("expands german umlauts", () => {
    expect(normalizeForSearch("Füße schön")).toBe("fuesse schoen");
  });

  it("transliterates cyrillic", () => {
    expect(normalizeForSearch("Привет Мир")).toBe("privet mir");
  });
});

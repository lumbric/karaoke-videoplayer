const GREEK_TO_LATIN_GERMAN: Record<string, string> = {
  "α": "a",
  "β": "v",
  "γ": "g",
  "δ": "d",
  "ε": "e",
  "ζ": "z",
  "η": "i",
  "θ": "th",
  "ι": "i",
  "κ": "k",
  "λ": "l",
  "μ": "m",
  "ν": "n",
  "ξ": "x",
  "ο": "o",
  "π": "p",
  "ρ": "r",
  "σ": "s",
  "ς": "s",
  "τ": "t",
  "υ": "y",
  "φ": "f",
  "χ": "ch",
  "ψ": "ps",
  "ω": "o"
};

function transliterateGreek(input: string): string {
  return Array.from(input).map((char) => GREEK_TO_LATIN_GERMAN[char] ?? char).join("");
}

export function normalizeForSearch(input: string): string {
  return transliterateGreek(input.toLowerCase())
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeNormalized(input: string): string[] {
  const normalized = normalizeForSearch(input);
  if (!normalized) {
    return [];
  }

  return normalized.split(" ");
}

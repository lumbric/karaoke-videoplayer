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

const CYRILLIC_TO_LATIN: Record<string, string> = {
  "а": "a",
  "б": "b",
  "в": "v",
  "г": "g",
  "д": "d",
  "е": "e",
  "ё": "e",
  "ж": "zh",
  "з": "z",
  "и": "i",
  "й": "i",
  "к": "k",
  "л": "l",
  "м": "m",
  "н": "n",
  "о": "o",
  "п": "p",
  "р": "r",
  "с": "s",
  "т": "t",
  "у": "u",
  "ф": "f",
  "х": "h",
  "ц": "ts",
  "ч": "ch",
  "ш": "sh",
  "щ": "sch",
  "ъ": "",
  "ы": "y",
  "ь": "",
  "э": "e",
  "ю": "yu",
  "я": "ya"
};

function normalizeGermanDigraphs(input: string): string {
  return input
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function transliterateToLatin(input: string): string {
  return Array.from(input)
    .map((char) => GREEK_TO_LATIN_GERMAN[char] ?? CYRILLIC_TO_LATIN[char] ?? char)
    .join("");
}

export function normalizeForSearch(input: string): string {
  // Normalize common German forms first so umlauts stay searchable as ae/oe/ue.
  const germanNormalized = normalizeGermanDigraphs(input.toLowerCase());

  // Remove diacritics before transliteration so greek letters like ή map to η.
  const deaccented = germanNormalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return transliterateToLatin(deaccented)
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

import { normalizeForSearch, tokenizeNormalized } from "./normalize";

function splitNormalizedTokens(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed.split(" ");
}

function isOneEditAway(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }

  if (Math.abs(a.length - b.length) > 1) {
    return false;
  }

  let shorter = a;
  let longer = b;
  if (shorter.length > longer.length) {
    shorter = b;
    longer = a;
  }

  let shorterIndex = 0;
  let longerIndex = 0;
  let edits = 0;

  while (shorterIndex < shorter.length && longerIndex < longer.length) {
    if (shorter[shorterIndex] === longer[longerIndex]) {
      shorterIndex += 1;
      longerIndex += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) {
      return false;
    }

    if (shorter.length === longer.length) {
      shorterIndex += 1;
    }

    longerIndex += 1;
  }

  return true;
}

function tokenScore(queryToken: string, haystackTokens: readonly string[]): number {
  let best = 0;

  for (const token of haystackTokens) {
    if (token === queryToken) {
      return 100;
    }

    if (token.startsWith(queryToken)) {
      best = Math.max(best, 80 - (token.length - queryToken.length));
      continue;
    }

    if (Math.abs(token.length - queryToken.length) > 1) {
      continue;
    }

    if (isOneEditAway(queryToken, token)) {
      best = Math.max(best, 88);
    }
  }

  return best;
}

export function scoreSearchTokens(queryTokens: readonly string[], candidateTokens: readonly string[]): number {
  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return -1;
  }

  let score = 0;

  for (const queryToken of queryTokens) {
    const tokenScoreValue = tokenScore(queryToken, candidateTokens);
    if (tokenScoreValue <= 0) {
      return -1;
    }

    score += tokenScoreValue;
  }

  return Math.round((score / queryTokens.length) * 4);
}

export function getSearchScore(query: string, candidateIndex: string, candidateTokens?: readonly string[]): number {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) {
    return 0;
  }

  const queryTokens = splitNormalizedTokens(normalizedQuery);
  if (queryTokens.length === 0) {
    return 0;
  }

  const normalizedCandidateTokens = candidateTokens ? [...candidateTokens] : tokenizeNormalized(candidateIndex);
  if (normalizedCandidateTokens.length === 0) {
    return -1;
  }

  return scoreSearchTokens(queryTokens, normalizedCandidateTokens);
}

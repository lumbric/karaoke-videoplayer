import { normalizeForSearch, tokenizeNormalized } from "./normalize";

function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  const next = new Array<number>(b.length + 1);

  for (let i = 0; i < a.length; i += 1) {
    next[0] = i + 1;

    for (let j = 0; j < b.length; j += 1) {
      const substitutionCost = a[i] === b[j] ? 0 : 1;
      next[j + 1] = Math.min(next[j] + 1, prev[j + 1] + 1, prev[j] + substitutionCost);
    }

    for (let k = 0; k < prev.length; k += 1) {
      prev[k] = next[k] as number;
    }
  }

  return prev[b.length] as number;
}

function tokenScore(queryToken: string, haystackTokens: string[]): number {
  let best = 0;

  for (const token of haystackTokens) {
    if (token === queryToken) {
      return 100;
    }

    if (token.startsWith(queryToken)) {
      best = Math.max(best, 80 - (token.length - queryToken.length));
      continue;
    }

    if (token.includes(queryToken)) {
      best = Math.max(best, 70 - Math.abs(token.length - queryToken.length));
      continue;
    }

    const distance = levenshteinDistance(queryToken, token);
    const maxDistance = queryToken.length <= 4 ? 1 : 2;
    if (distance <= maxDistance) {
      const lengthDelta = Math.abs(token.length - queryToken.length);
      const baseScore = distance === 1 ? 64 : 54;
      best = Math.max(best, baseScore - (distance - 1) * 8 - lengthDelta * 4);
    }
  }

  return best;
}

export function getSearchScore(query: string, candidateIndex: string): number {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) {
    return 0;
  }

  const normalizedCandidate = normalizeForSearch(candidateIndex);
  if (!normalizedCandidate) {
    return -1;
  }

  if (normalizedCandidate.includes(normalizedQuery)) {
    return 300 - Math.abs(normalizedCandidate.length - normalizedQuery.length);
  }

  const queryTokens = tokenizeNormalized(normalizedQuery);
  const candidateTokens = tokenizeNormalized(normalizedCandidate);
  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return -1;
  }

  let score = 0;
  for (const queryToken of queryTokens) {
    score += tokenScore(queryToken, candidateTokens);
  }

  const average = score / queryTokens.length;
  return average >= 45 ? Math.round(average * 4) : -1;
}

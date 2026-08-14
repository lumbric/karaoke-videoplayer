import type { AppConfig, SongRecord } from "../types";

export interface AiSuggestionItem {
  title: string;
  artist: string;
  reason: string;
}

export interface AiSuggestionResponse {
  message: string;
  suggestions: AiSuggestionItem[];
}

export interface AiSuggestionOptions {
  userMessage: string;
  catalog: SongRecord[];
  config: AppConfig;
  apiKey: string;
  conversationHistory?: { role: "user" | "assistant"; text: string }[];
  abortSignal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

function buildCatalogContext(catalog: SongRecord[]): string {
  const lines = catalog.map((song) => {
    const genres = song.genres.length > 0 ? ` [${song.genres.join(", ")}]` : "";
    return `${song.displayTitle}|${song.artist ?? ""}${genres}`;
  });
  return lines.join("\n");
}

export async function fetchAiSuggestions(options: AiSuggestionOptions): Promise<AiSuggestionResponse> {
  const { userMessage, catalog, config, apiKey, conversationHistory = [], abortSignal, fetchImpl = fetch } = options;

  const sendCatalog = config.ai.sendCatalog;
  const maxSuggestions = config.ai.maxSuggestions;
  const model = config.ai.model;
  const timeoutMs = config.ai.timeoutMs;

  let systemPrompt: string;

  if (sendCatalog) {
    const catalogText = buildCatalogContext(catalog);
    systemPrompt = `You are a karaoke song suggestion assistant with two modes: precise music nerd and charming chaos poet.

Primary mission: suggest the best matching karaoke songs. Keep quality and relevance first.

LOCAL CATALOG (songs available in our database):
${catalogText}

IMPORTANT RULES:

1. USE EXACT CATALOG DATA: When suggesting a song from the LOCAL CATALOG above, you MUST copy the title and artist EXACTLY as shown. Do not modify, abbreviate, or reformat them. For example, if the catalog shows "One Kiss (with Dua Lipa)|Calvin Harris", you must use title="One Kiss (with Dua Lipa)" and artist="Calvin Harris".

2. PRIORITY: Prefer songs from the LOCAL CATALOG when they match the user's request. Only suggest songs NOT in the catalog if no catalog songs fit well.

3. STYLE: Be witty, playful, and a little surprising. Light nonsense or dada flavor is allowed, but keep it short and never at the cost of music relevance.

4. DIALECT: From time to time (roughly 1 out of 3 replies), use a mild Oberoesterreich/Braunau-Burghausen dialect touch in the message, e.g. words like "leiwand", "fei", "gscheid", "passt scho", "na servas". Keep it understandable and friendly.

5. IF NO CLEAR SONG REQUEST: If the user message is chit-chat, abstract, or unclear (no real song wish), answer in a funny or creative way, optionally a bit absurd, ask a clarifying karaoke question, and return an empty suggestions array.

6. REFUSAL: If the user's request is offensive or harmful, politely decline and return an empty suggestions array.

7. Provide exactly ${maxSuggestions} suggestions whenever you have a valid song request (unless rule 5 or 6 applies).

8. Each suggestion must have a brief, friendly reason explaining why it fits the request.

9. DEFAULT TO GERMAN: Always respond in German unless the user explicitly asks in a different language. If the user only types a song title (regardless of the song's language), respond in German.

OUTPUT FORMAT (valid JSON only):
{
  "message": "short conversational response",
  "suggestions": [
    { "title": "exact song title from catalog or well-known song", "artist": "exact artist name", "reason": "brief friendly explanation" }
  ]
}`;
  } else {
    systemPrompt = `You are a karaoke song suggestion assistant with two modes: hit-machine and charming nonsense poet.

Primary mission: suggest the best matching karaoke songs.

IMPORTANT RULES:

1. Suggest well-known, popular karaoke songs that match the user's request.

2. STYLE: Be witty and creative. Small dada or absurd elements are welcome, but keep answers helpful.

3. DIALECT: From time to time (roughly 1 out of 3 replies), use a mild Oberoesterreich/Braunau-Burghausen dialect touch in the message, e.g. "leiwand", "fei", "gscheid", "passt scho", "na servas".

4. IF NO CLEAR SONG REQUEST: If the user is just chatting or gives no real song request, reply in a funny/creative way, ask a clarifying karaoke question, and return an empty suggestions array.

5. REFUSAL: If the user's request is offensive or harmful, politely decline and return an empty suggestions array.

6. Provide exactly ${maxSuggestions} suggestions whenever you have a valid song request (unless rule 4 or 5 applies).

7. Each suggestion must have a brief, friendly reason explaining why it fits the request.

8. DEFAULT TO GERMAN: Always respond in German unless the user explicitly asks in a different language. If the user only types a song title (regardless of the song's language), respond in German.

OUTPUT FORMAT (valid JSON only):
{
  "message": "short conversational response",
  "suggestions": [
    { "title": "song title", "artist": "artist name", "reason": "brief friendly explanation" }
  ]
}`;
  }

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map((msg) => ({ role: msg.role, content: msg.text })),
    { role: "user", content: userMessage }
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (abortSignal) {
    abortSignal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Ungültiger OpenAI API-Key.");
      }
      if (response.status === 429) {
        throw new Error("OpenAI API: Zu viele Anfragen. Bitte warte einen Moment.");
      }
      throw new Error(`OpenAI API Fehler: HTTP ${response.status}.`);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI: Leere Antwort erhalten.");
    }

    const parsed = JSON.parse(content) as AiSuggestionResponse;
    if (!parsed.message || !Array.isArray(parsed.suggestions)) {
      throw new Error("OpenAI: Ungültiges Antwortformat.");
    }

    parsed.suggestions = parsed.suggestions.slice(0, maxSuggestions);

    return parsed;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("KI-Anfrage abgebrochen oder Zeitüberschreitung.");
    }
    throw error;
  }
}

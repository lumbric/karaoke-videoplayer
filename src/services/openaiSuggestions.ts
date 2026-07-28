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

  const catalogText = buildCatalogContext(catalog);
  const maxSuggestions = config.ai.maxSuggestions;
  const model = config.ai.model;
  const timeoutMs = config.ai.timeoutMs;

  const systemPrompt = `You are a helpful karaoke song suggestion assistant. The user wants to sing karaoke and needs song suggestions based on their request.

Local song catalog (title|artist [genre]):
${catalogText}

Respond in the same language as the user.
Output ONLY valid JSON with this exact structure:
{
  "message": "a short conversational response",
  "suggestions": [
    { "title": "song title", "artist": "artist name", "reason": "brief friendly explanation why this fits" }
  ]
}

Rules:
- Prefer suggesting songs from the catalog when they match the request.
- If no catalog song fits, suggest well-known karaoke songs.
- Provide exactly ${maxSuggestions} suggestions.
- Each suggestion must have a brief, friendly reason.
- The "message" should be a short conversational response.`;

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
        throw new Error("Ungueltiger OpenAI API-Key.");
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
      throw new Error("OpenAI: Ungueltiges Antwortformat.");
    }

    parsed.suggestions = parsed.suggestions.slice(0, maxSuggestions);

    return parsed;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("KI-Anfrage abgebrochen oder Zeitueberschreitung.");
    }
    throw error;
  }
}

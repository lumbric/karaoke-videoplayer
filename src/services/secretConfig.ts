import type { SecretConfig } from "../types";

export async function loadSecretConfig(fetchImpl: typeof fetch = fetch): Promise<SecretConfig> {
  let response: Response;
  try {
    response = await fetchImpl("/secret-config.json", { cache: "no-store" });
  } catch (error) {
    // Secret config is optional unless required by provider validation.
    // A missing file is treated as empty secrets.
    return {};
  }

  if (!response.ok) {
    return {};
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return {};
  }

  if (!json || typeof json !== "object") {
    return {};
  }

  const raw = json as Record<string, unknown>;
  return {
    openAiApiKey: typeof raw.openAiApiKey === "string" ? raw.openAiApiKey : undefined,
    youtubeApiKey: typeof raw.youtubeApiKey === "string" ? raw.youtubeApiKey : undefined
  };
}

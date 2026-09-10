/** Identificador canônico do DeepSeek V4.1 Flash. */
export const DEEPSEEK_FLASH_MODEL = "deepseek-flash";
export const DEEPSEEK_FLASH_DISPLAY_NAME = "DeepSeek V4.1 Flash";

const DEEPSEEK_FLASH_ALIASES = new Set([
  DEEPSEEK_FLASH_MODEL,
  "deepseek-v4-flash",
  "deepseek-v4.1-flash",
  "deepseek-v4-1-flash",
]);

export function canonicalizeDeepSeekModel(modelId: string): string {
  const trimmed = modelId.trim();
  return DEEPSEEK_FLASH_ALIASES.has(trimmed.toLowerCase()) ? DEEPSEEK_FLASH_MODEL : trimmed;
}

export function normalizeDeepSeekModels(modelIds: readonly string[]): string[] {
  return [...new Set(modelIds.map(canonicalizeDeepSeekModel).filter(Boolean))];
}

/** Injeta `thinking.disabled` no corpo OpenAI-compatible para reduzir latência. */
export function withDeepSeekThinkingDisabled(fetchImpl: typeof fetch): typeof fetch {
  return async (input, init) => {
    if (typeof init?.body !== "string") return fetchImpl(input, init);

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(init.body);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return fetchImpl(input, init);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return fetchImpl(input, init);
    }

    if (body.thinking !== undefined) return fetchImpl(input, init);
    return fetchImpl(input, {
      ...init,
      body: JSON.stringify({ ...body, thinking: { type: "disabled" } }),
    });
  };
}

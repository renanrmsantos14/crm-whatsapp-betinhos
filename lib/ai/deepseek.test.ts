import { describe, expect, it, vi } from "vitest";

import {
  canonicalizeDeepSeekModel,
  normalizeDeepSeekModels,
  withDeepSeekThinkingDisabled,
} from "./deepseek";

describe("DeepSeek V4.1 Flash", () => {
  it("normaliza o nome atual e aliases legados", () => {
    expect(canonicalizeDeepSeekModel("DeepSeek-V4.1-Flash")).toBe("deepseek-flash");
    expect(canonicalizeDeepSeekModel("deepseek-v4-flash")).toBe("deepseek-flash");
    expect(normalizeDeepSeekModels(["deepseek-flash", "deepseek-v4-flash", "deepseek-chat"])).toEqual([
      "deepseek-flash",
      "deepseek-chat",
    ]);
  });

  it("desliga o pensamento no corpo OpenAI-compatible sem sobrescrever override", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return new Response(JSON.stringify({ body: init?.body }), { status: 200 });
    });
    const fastFetch = withDeepSeekThinkingDisabled(fetchImpl);

    await fastFetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model: "deepseek-flash", messages: [] }),
    });
    expect(JSON.parse(fetchImpl.mock.calls[0]![1]?.body as string).thinking).toEqual({ type: "disabled" });

    await fastFetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      body: JSON.stringify({ thinking: { type: "enabled" } }),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[1]![1]?.body as string).thinking).toEqual({ type: "enabled" });
  });
});

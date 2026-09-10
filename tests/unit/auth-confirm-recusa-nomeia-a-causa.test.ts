/**
 * A RECUSA DE UM LINK DE E-MAIL PRECISA DIZER QUAL DAS DUAS COISAS QUEBROU.
 *
 * `/auth/confirm` aceita dois formatos de link e, até 2026-08-14, mandava os
 * dois para a MESMA tela: `/login?error=link_invalido` → "Link inválido ou
 * expirado. Peça um novo em Recuperar senha". Isso é conselho certo para um
 * caso e conselho ERRADO para o outro:
 *
 *  - `token_hash` (nossos templates): o link realmente expirou ou já foi usado.
 *    Pedir outro resolve.
 *  - `code` (template PADRÃO do Supabase): o link chega por PKCE, e o
 *    verificador temporário usa `SameSite=Lax` para atravessar a navegação
 *    cross-site. Se falhar, o link realmente expirou, foi usado ou voltou sem
 *    o cookie do navegador.
 *
 * O audit ainda registra o formato dos dois links para a triagem. A tela usa
 * `link_invalido` nos dois casos, porque pedir outro link é a ação válida.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth/provision", () => ({ ensureTenantForUser: vi.fn(async () => undefined) }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://crm.exemplo.com.br" } }));

import { GET } from "@/app/auth/confirm/route";

type Resultado = { data: { user: unknown }; error: { message: string } | null };

const RECUSA: Resultado = { data: { user: null }, error: { message: "Token has expired" } };

function supabaseQue(resposta: Resultado) {
  const verifyOtp = vi.fn(async () => resposta);
  const exchangeCodeForSession = vi.fn(async () => resposta);
  vi.mocked(createClient).mockResolvedValue({
    auth: { verifyOtp, exchangeCodeForSession },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return { verifyOtp, exchangeCodeForSession };
}

const chamar = (query: string) =>
  GET(new NextRequest(`https://crm.exemplo.com.br/auth/confirm${query}`));

/** O `Location` do redirect, sem o host. */
async function destino(query: string): Promise<string> {
  const res = await chamar(query);
  return new URL(res.headers.get("location") ?? "").search;
}

describe("/auth/confirm nomeia a causa da recusa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("token_hash que falhou continua sendo `link_invalido` — pedir outro resolve", () => {
    supabaseQue(RECUSA);
    return expect(destino("?token_hash=abc&type=recovery")).resolves.toBe("?error=link_invalido");
  });

  it("code que falhou vira `link_invalido`", async () => {
    supabaseQue(RECUSA);
    expect(await destino("?code=pkce_abc")).toBe("?error=link_invalido");
  });

  it("deixa Lax somente no verificador PKCE e mantém a sessão Strict", () => {
    const fonte = fs.readFileSync(path.join(process.cwd(), "lib/supabase/server.ts"), "utf8");
    expect(fonte).toContain('name.endsWith("-code-verifier")');
    expect(fonte).toContain('sameSite: "lax" as const');
    expect(fonte).toContain('sameSite: "strict"');
  });

  it("link sem token nenhum continua `link_invalido` e não chama o Supabase", async () => {
    const { verifyOtp, exchangeCodeForSession } = supabaseQue(RECUSA);
    expect(await destino("")).toBe("?error=link_invalido");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("o audit registra QUAL formato falhou — sem isso a triagem começa do zero", async () => {
    supabaseQue(RECUSA);
    await chamar("?code=pkce_abc");
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.email_link_rejected",
        metadata: expect.objectContaining({ formato: "code" }),
      }),
    );

    vi.clearAllMocks();
    supabaseQue(RECUSA);
    await chamar("?token_hash=abc&type=signup");
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.email_link_rejected",
        metadata: expect.objectContaining({ formato: "token_hash" }),
      }),
    );
  });

  it("a tela do login tem texto para link inválido", () => {
    const fonte = fs.readFileSync(
      path.join(process.cwd(), "app/(public)/login/page.tsx"),
      "utf8",
    );
    expect(fonte).toContain('error === "link_invalido"');
    expect(fonte).toContain("Link inválido ou expirado");
  });
});

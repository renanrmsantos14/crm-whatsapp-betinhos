import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import InboxLoading from "@/app/app/inbox/loading";
import { loadAuthUserForRender, resolveActiveOrg } from "@/lib/auth/server";
import { InboxLayout } from "@/components/inbox/InboxLayout";
import type { ConversationsInitialData } from "@/hooks/inbox/useConversationsRealtime";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import { listConversationsHandler } from "@/app/api/v1/conversations/_handler";
import { comNomeDoAtendente } from "@/lib/users/com-nome-do-atendente";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function carregarFilaInicial(
  organizationId: string,
  userId: string,
  idioma: Parameters<typeof traduzir>[1],
): Promise<ConversationsInitialData | undefined> {
  try {
    const result = await listConversationsHandler(
      await createClient(),
      {
        organization_id: organizationId,
        actor: { type: "user", id: userId },
        requestId: randomUUID(),
        idioma,
      },
      {
        status: undefined,
        comando: undefined,
        fila: true,
        limit: 50,
      },
    );

    return {
      data: await comNomeDoAtendente(result.conversations),
      meta: { cursor: result.cursor, has_more: result.has_more },
    };
  } catch (error) {
    // O primeiro HTML não pode virar 500 só porque a fila falhou. O hook do
    // navegador continua sendo a recuperação normal e mostra o erro acionável.
    logger.warn("[inbox] não foi possível preparar a fila inicial", {
      error_name: error instanceof Error ? error.name : "unknown",
    });
    return undefined;
  }
}

async function InboxComFilaInicial({
  organizationId,
  userId,
  idioma,
  initialSelectedId,
  carregarInicial,
}: {
  organizationId: string;
  userId: string;
  idioma: Parameters<typeof traduzir>[1];
  initialSelectedId: string | null;
  carregarInicial: boolean;
}) {
  const initialConversations = carregarInicial
    ? await carregarFilaInicial(organizationId, userId, idioma)
    : undefined;

  return (
    <InboxLayout
      initialSelectedId={initialSelectedId}
      initialConversations={initialConversations}
    />
  );
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; filter?: string }>;
}) {
  const user = await loadAuthUserForRender();
  if (!user) redirect("/login");
  const [activeOrg, params] = await Promise.all([resolveActiveOrg(user), searchParams]);
  if (!activeOrg) {
    const idioma = user.idioma;
    // As duas saídas que a frase anterior oferecia — "aceite um convite" e
    // "contate o admin" — não existem para quem INSTALOU o sistema: não há
    // convite e o admin é ele. Este é o estado terminal do primeiro acesso que
    // falhou, e o link é a única porta para fora dele.
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <p>
          {traduzir(
            "Você não tem nenhuma organização ativa. Configure sua organização ou aceite um convite.",
            idioma,
          )}
        </p>
        <Link className="text-primary underline underline-offset-4" href="/get-started">
          {traduzir("Configurar minha organização", idioma)}
        </Link>
      </div>
    );
  }
  const carregarInicial = !params.filter || params.filter === "unassigned";
  return (
    <Suspense fallback={<InboxLoading />}>
      <InboxComFilaInicial
        organizationId={activeOrg.orgId}
        userId={user.id}
        idioma={user.idioma}
        initialSelectedId={params.id ?? null}
        carregarInicial={carregarInicial}
      />
    </Suspense>
  );
}

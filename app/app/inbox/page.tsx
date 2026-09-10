import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import InboxLoading from "@/app/app/inbox/loading";
import { loadAuthUserForRender, resolveActiveOrg } from "@/lib/auth/server";
import { InboxLayout } from "@/components/inbox/InboxLayout";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";

async function InboxComFilaInicial({
  initialSelectedId,
}: {
  initialSelectedId: string | null;
}) {
  return <InboxLayout initialSelectedId={initialSelectedId} />;
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
  return (
    <Suspense fallback={<InboxLoading />}>
      <InboxComFilaInicial
        initialSelectedId={params.id ?? null}
      />
    </Suspense>
  );
}

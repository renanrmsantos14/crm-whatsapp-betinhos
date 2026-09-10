"use client";
import { OrganizationTransitionProvider } from "@/components/shell/OrganizationTransitionProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { makeQueryClient } from "@/lib/query/client";

// Devtools não fazem parte do produto. O import estático colocava o pacote no
// grafo inicial de toda página durante o desenvolvimento, mesmo quando o
// painel permanecia fechado. Carregar só quando o Provider realmente o
// renderiza mantém o diagnóstico disponível sem cobrar esse peso do primeiro
// paint em cada navegação.
const ReactQueryDevtools = dynamic(
  () => import("@tanstack/react-query-devtools").then((module) => module.ReactQueryDevtools),
  { ssr: false },
);

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());
  return (
    <OrganizationTransitionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </OrganizationTransitionProvider>
  );
}

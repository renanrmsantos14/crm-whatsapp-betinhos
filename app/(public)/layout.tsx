import { marcaDaSaidaPublica } from "@/lib/branding/saida";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";

/**
 * A casca das telas de acesso — login, cadastro, recuperação, MFA.
 *
 * ── Por que o LOGO mora aqui, e não em `login/page.tsx` ───────────────────────
 *
 * São seis telas no grupo `(public)`, e todas são "antes de entrar": quem instala
 * o produto para clientes mostra a marca dele exatamente aí. Um `<img>` por
 * página seriam seis cópias que divergem na primeira vez que alguém mexer numa
 * só — e a que ficaria para trás é sempre a que ninguém abre (recuperação de
 * senha, cadastro de MFA), que é justamente onde o cliente do revendedor
 * aparece sozinho e sem contexto.
 *
 * ── Por que `marcaDaSaidaPublica()` ──────────────────────────────────────────
 *
 * Aqui não existe organização resolvida e a tela não pode depender de rede:
 * `marcaDaSaidaPublica` usa a camada `.env`, que é a rede de segurança para
 * entrar e corrigir a instalação. As telas autenticadas e os e-mails continuam
 * usando a pilha completa por `marcaDaSaida`. O resolvedor nunca lança.
 *
 * O NOME continua saindo de `branding()` dentro de cada página — não é descuido,
 * está medido em `tests/e2e/icone-da-marca.spec.ts:64-77`: aquela spec cruza duas
 * resoluções independentes (o título da aba, que lê o banco, contra o texto sob
 * o "Entrar", que lê o `.env`). Trocar o texto para este mesmo resolvedor
 * deixaria a spec verde medindo nada.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const marca = marcaDaSaidaPublica();
  // A casca pública precisa renderizar sem rede ou sessão. O provider usa
  // pt-BR quando não há locale disponível; isso não bloqueia login/cadastro.
  const locale = null;

  return (
    <IdiomaProvider locale={locale}>
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-6">
          {marca.logoUrl && (
            <div className="flex justify-center">
              {/*
                <img> em vez de next/image pelo mesmo motivo da barra lateral: a URL
                é de quem hospeda e o `next/image` exige allowlist de domínios
                fechada em BUILD — a imagem pré-buildada do self-host recusaria o
                domínio do operador. Altura fixa e largura livre para não distorcer
                arte de proporção desconhecida.

                O `alt` é o nome DESTA resolução (`marca.nome`), e não o de
                `branding()`: é a legenda da imagem que está ali, e nomeá-la com a
                marca de outra fonte descreveria uma marca que não é a do logo.

                O `data-testid` é lido por `tests/e2e/marca-logo.spec.ts`, que prova
                que o logo da EMPRESA não vaza para cá. Sem ele a spec caía na
                "primeira <img> da página", e uma asserção de negação com seletor
                largo passa sozinha assim que outra imagem entra na tela.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-testid="logo-da-fachada"
                src={marca.logoUrl}
                alt={marca.nome}
                className="h-10 w-auto max-w-[12rem] object-contain"
              />
            </div>
          )}
          {children}
        </div>
      </div>
    </IdiomaProvider>
  );
}

# Suporte oficial a ARM64 para Oracle Cloud

**Status:** aguardando aprovação
**Data:** 2026-09-10

## Objetivo

Permitir que uma instalação nova do produto rode oficialmente em uma VM Oracle Cloud Ampere A1 (`linux/arm64`), mantendo compatibilidade com servidores `linux/amd64` e sem exigir compilação das imagens na máquina do cliente.

## Contexto confirmado

- As imagens publicadas do `app`, `worker` e `scheduler` são construídas apenas para `linux/amd64`.
- O `docker-compose.prod.yml` usa por padrão `devlikeapro/waha:latest-2026.7.2`, voltada ao fluxo AMD64 atual.
- A WAHA publica a variante ARM64 `devlikeapro/waha:noweb-arm-2026.7.2`.
- As dependências externas usadas pelo compose (`redis:7-alpine`, `caddy:2-alpine` e a imagem fixada do adaptador HTTP do Redis) possuem manifesto ARM64.
- O fluxo de publicação já centraliza as imagens do produto e só inicia a promoção das tags `stable` depois dos builds exigidos.

## Resultado esperado

Uma instalação feita pelo kit oficial deve:

1. detectar automaticamente `amd64` ou `arm64`;
2. selecionar a imagem WAHA compatível com a arquitetura;
3. baixar imagens multi-arquitetura do produto sem compilar na VPS;
4. preservar os mesmos volumes, variáveis, portas internas e contratos operacionais;
5. falhar com mensagem acionável quando a arquitetura não for suportada.

## Fora de escopo

- Migrar Next.js, workers ou banco para Cloudflare Workers, D1 ou Containers.
- Hospedar o Supabase completo na VM gratuita.
- Alterar regras de negócio, schema, RLS, autenticação ou APIs.
- Expor o painel administrativo da WAHA diretamente na internet.
- Trocar tags fixas de dependências por tags móveis.

## Alternativas avaliadas

### 1. Publicar imagens multi-arquitetura — escolhida

O CI produz manifestos `linux/amd64` e `linux/arm64` para `app`, `worker` e `scheduler` sob as mesmas tags de versão. O Docker escolhe automaticamente a variante correta no servidor.

**Vantagens:** instalação simples, atualização previsível, nenhum build pesado na VPS e paridade entre arquiteturas.
**Custo:** publicação mais demorada e necessidade de validar dependências nativas nas duas arquiteturas.

### 2. Compilar o projeto na VM ARM64

Usar `docker-compose.build.yml` para construir tudo no Oracle A1.

**Vantagem:** não exige mudança na publicação.
**Rejeitada como padrão:** consome CPU, memória, disco e tempo do servidor do cliente; também contraria a regra de que a instalação de produção deve consumir imagens publicadas.

### 3. Migrar a aplicação para Cloudflare Workers

Manter apenas a WAHA em outra máquina e adaptar aplicação, jobs e persistência aos runtimes Cloudflare.

**Rejeitada:** é uma reescrita arquitetural, não resolve a necessidade da WAHA persistente e Cloudflare Containers não atende ao requisito de hospedagem gratuita.

## Desenho técnico

### Publicação das imagens do produto

O workflow `.github/workflows/publish-image.yml` passará a publicar:

- `linux/amd64`
- `linux/arm64`

Isso será aplicado às imagens do `app`, `worker` e `scheduler`. Cada tag existente continuará sendo um único nome público, mas apontará para um manifesto com as duas arquiteturas.

A promoção de `stable` continuará coordenada pelo job final: se qualquer variante ou imagem falhar, a promoção não começa e o job obrigatório `imagens-ok` reprova. As três atualizações no registro continuam sequenciais, como são hoje; portanto, não serão descritas como uma transação atômica.

O workflow instalará emulação ARM64 antes do Buildx. O gate que hoje sobe a imagem do app será executado separadamente para AMD64 e ARM64, com uma tag local por arquitetura, para provar que ambas chegam a iniciar — não apenas que o Dockerfile compila.

Nenhum segredo será incorporado como argumento de build. As configurações continuarão sendo fornecidas em runtime pelo arquivo `.env`.

### Seleção da imagem WAHA

O instalador consultará `uname -m` e normalizará:

| Resultado | Arquitetura | Imagem WAHA |
|---|---|---|
| `x86_64`, `amd64` | AMD64 | `devlikeapro/waha:latest-2026.7.2` |
| `aarch64`, `arm64` | ARM64 | `devlikeapro/waha:noweb-arm-2026.7.2` |

O valor detectado será gravado em `WAHA_IMAGE` durante a criação do `.env`. Um valor já definido explicitamente pelo operador será preservado.

Arquiteturas diferentes dessas quatro formas conhecidas interromperão a instalação antes de subir os contêineres, exibindo a arquitetura encontrada e as opções suportadas.

O padrão atual do `docker-compose.prod.yml` será mantido para não alterar silenciosamente instalações AMD64 existentes. A execução direta do compose em ARM64, fora do instalador, exigirá `WAHA_IMAGE=devlikeapro/waha:noweb-arm-2026.7.2`, e isso será documentado junto ao comando de instalação manual.

### Compatibilidade e atualização

- Instalações AMD64 continuam usando a mesma WAHA e os mesmos nomes de imagem.
- Instalações ARM64 recebem a variante WAHA específica e as variantes ARM64 das imagens próprias.
- Volumes persistentes, dados da sessão WAHA e banco não serão recriados por causa da arquitetura.
- Atualizações continuarão apontando para versões numeradas; `stable` não substituirá a política de pinagem do instalador.
- Um bump da WAHA deverá atualizar o par de tags AMD64/ARM64 e seus testes na mesma mudança.

## Arquivos previstos na implementação

- `.github/workflows/publish-image.yml`: adicionar emulação, as duas plataformas aos builds publicados e smoke de boot por arquitetura.
- `hostgator-setup-kit/install.sh`: detectar arquitetura e definir `WAHA_IMAGE`.
- `docker-compose.prod.yml`: esclarecer o contrato do padrão AMD64 e do override ARM64.
- `hostgator-setup-kit/test-validators.sh`: validar detecção, preservação de override e falha para arquitetura desconhecida.
- `tests/unit/arm64-packaging.test.ts`: proteger plataformas de publicação e o pareamento das tags WAHA.
- `hostgator-setup-kit/README.md`: documentar instalação Oracle A1 e execução manual.
- `docs/runbooks/deploy.md`: acrescentar validação operacional ARM64.
- `docs/runbooks/waha-hostgator.md`: registrar imagens WAHA por arquitetura.

Durante a implementação, arquivos gerados, migrations, schema e código de negócio não serão alterados.

## Validação

Antes da entrega do código:

1. `pnpm test:shell` deve validar o kit e os arquivos de compose.
2. O teste unitário direcionado deve confirmar `linux/amd64,linux/arm64` nas três imagens próprias.
3. O teste unitário deve confirmar que as tags WAHA AMD64 e ARM64 permanecem na mesma versão.
4. `pnpm gov:verify` deve passar sem erros.
5. O workflow de publicação deve construir as duas variantes de cada imagem e iniciar o app em ambas.
6. Após uma publicação de teste ou release, `docker buildx imagetools inspect` deve mostrar manifestos AMD64 e ARM64 para `app`, `worker` e `scheduler`.
7. Uma instalação fresca em Oracle A1 deve subir todos os serviços, concluir o healthcheck e permitir o pareamento da WAHA por QR code.

Os itens 5 a 7 dependem do CI e de uma VM ARM64 real. Validação local não será apresentada como prova desses itens.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Dependência nativa do Node não compila em ARM64 | Build ARM64 obrigatório no CI antes da promoção das tags. |
| Publicação parcial entre arquiteturas | Manter a promoção dependente de todos os builds e do check `imagens-ok`. |
| Versões WAHA divergirem entre AMD64 e ARM64 | Teste de pareamento das tags e atualização conjunta. |
| Operador executar compose diretamente em ARM64 | Documentar o override obrigatório e fornecer exemplo copiável. |
| Falta de capacidade gratuita na região Oracle | Tratar como limitação externa; não prometer disponibilidade da VM. |
| Origem exposta na internet | Recomendar firewall restritivo e Cloudflare Tunnel; não publicar o painel WAHA. |

## Critérios de aceite

- O mesmo release oferece imagens próprias para `linux/amd64` e `linux/arm64`.
- Uma instalação nova em `aarch64` escolhe a WAHA ARM64 sem edição manual.
- Uma instalação nova em `x86_64` mantém o comportamento atual.
- `WAHA_IMAGE` fornecida pelo operador nunca é sobrescrita.
- Arquitetura desconhecida falha antes de qualquer alteração destrutiva.
- Todos os gates locais aplicáveis ficam verdes.
- A documentação distingue claramente o que foi validado localmente, no CI e em uma VM Oracle real.

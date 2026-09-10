import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const COMPOSES = ["docker-compose.yml", "docker-compose.prod.yml"];

describe("autenticação do WAHA nos composes", () => {
  for (const arquivo of COMPOSES) {
    const compose = readFileSync(arquivo, "utf8");

    it(`${arquivo}: entrega ao WAHA o hash com o prefixo sha512`, () => {
      expect(compose).toMatch(
        /WAHA_API_KEY:\s*"sha512:\$\{WAHA_API_KEY_SHA512(?::\?[^}]*)?\}"/,
      );
    });
  }

  it("o compose local falha antes de subir quando o hash não foi carregado", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");
    expect(compose).toContain("${WAHA_API_KEY_SHA512:?WAHA_API_KEY_SHA512 is required}");
  });

  it("o setup carrega explicitamente o .env.local no compose", () => {
    const setup = readFileSync("docs/SETUP.md", "utf8");
    expect(setup).toContain("docker compose --env-file .env.local up -d waha");
  });

  it("o template declara o hash que o compose exige", () => {
    const envExample = readFileSync(".env.example", "utf8");
    expect(envExample).toMatch(/^WAHA_API_KEY_SHA512=$/m);
  });

  it("o cliente mantém a chave plaintext no header X-Api-Key", () => {
    const client = readFileSync("lib/waha/client.ts", "utf8");
    expect(client).toContain('headers: { "X-Api-Key": this.apiKey');
  });
});

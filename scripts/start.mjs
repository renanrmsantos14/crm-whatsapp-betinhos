import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const serverPath = resolve(process.cwd(), ".next", "standalone", "server.js");
const standaloneDir = resolve(process.cwd(), ".next", "standalone");

if (!existsSync(serverPath)) {
  console.error(
    "Build não encontrado. Execute `corepack pnpm build` antes de `corepack pnpm start`.",
  );
  process.exit(1);
}

// O output standalone não copia estes diretórios sozinho. O Dockerfile faz
// isso na imagem; o comando local precisa fazer o mesmo para CSS, JS e assets
// não responderem 404 depois de um build.
const runtimeAssets = [
  [resolve(process.cwd(), ".next", "static"), resolve(standaloneDir, ".next", "static")],
  [resolve(process.cwd(), "public"), resolve(standaloneDir, "public")],
];
for (const [source, target] of runtimeAssets) {
  if (existsSync(source)) cpSync(source, target, { recursive: true, force: true });
}

const child = spawn(process.execPath, [serverPath], {
  cwd: standaloneDir,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("Não foi possível iniciar o servidor standalone:", error.message);
  process.exit(1);
});

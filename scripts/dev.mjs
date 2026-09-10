import { createServer } from "node:net";
import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = 3000;
const MAX_PORT_SEARCH = 20;
const HEALTHCHECK_TIMEOUT_MS = 800;

function readPort(args) {
  const portIndex = args.findIndex((arg) => arg === "--port" || arg === "-p");
  const value = portIndex >= 0 ? args[portIndex + 1] : process.env.PORT;
  const port = Number(value ?? DEFAULT_PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Porta inválida: ${value}`);
  }

  return { port, portIndex };
}

function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findRunningNextPort(startPort) {
  for (let offset = 0; offset < MAX_PORT_SEARCH; offset += 1) {
    const port = startPort + offset;

    if (port > 65_535) {
      break;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS);

    try {
      const response = await fetch(`http://127.0.0.1:${port}/login`, {
        signal: controller.signal,
      });
      const pathname = response.headers.get("x-pathname");

      if (pathname === "/login" && response.status < 500) {
        return port;
      }
    } catch {
      // A porta não está respondendo; a busca continua.
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

async function findAvailablePort(startPort) {
  for (let offset = 0; offset < MAX_PORT_SEARCH; offset += 1) {
    const port = startPort + offset;

    if (port <= 65_535 && (await isPortAvailable(port))) {
      return port;
    }
  }

  throw new Error(
    `Nenhuma porta livre encontrada entre ${startPort} e ${startPort + MAX_PORT_SEARCH - 1}.`,
  );
}

function withPortArg(args, port, portIndex) {
  if (portIndex >= 0) {
    const nextArgs = [...args];
    nextArgs[portIndex + 1] = String(port);
    return nextArgs;
  }

  return [...args, "--port", String(port)];
}

const nextArgs = process.argv.slice(2);
const { port: requestedPort, portIndex } = readPort(nextArgs);
const runningPort = await findRunningNextPort(requestedPort);

if (runningPort !== null) {
  console.info(`[dev] O CRM já está rodando em http://localhost:${runningPort}`);
  console.info(
    "[dev] Use essa URL no navegador. Para reiniciar, encerre o terminal do servidor atual.",
  );
  process.exitCode = 0;
} else {
  const port = await findAvailablePort(requestedPort);

  if (port !== requestedPort) {
    console.warn(
      `[dev] A porta ${requestedPort} já está ocupada. Iniciando o CRM em http://localhost:${port}.`,
    );
  }

  console.info(`[dev] Abrindo Next.js em http://localhost:${port}`);

  const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
  const child = spawn(
    process.execPath,
    [nextCli, "dev", ...withPortArg(nextArgs, port, portIndex)],
    {
      env: { ...process.env, PORT: String(port) },
      stdio: "inherit",
      shell: false,
    },
  );

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.once("SIGINT", () => forwardSignal("SIGINT"));
  process.once("SIGTERM", () => forwardSignal("SIGTERM"));

  child.once("error", (error) => {
    console.error(`[dev] Não foi possível iniciar o Next.js: ${error.message}`);
    process.exitCode = 1;
  });

  child.once("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

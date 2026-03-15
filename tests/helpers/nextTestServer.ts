import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";

export type NextTestServer = {
  origin: string;
  stop(): Promise<void>;
};

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to determine an available port.")));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function formatLogs(lines: string[]): string {
  return lines.length ? lines.join("\n") : "(no server output captured)";
}

async function waitForServerReady(
  origin: string,
  child: ChildProcess,
  logs: string[],
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next test server exited early with code ${child.exitCode}.\n${formatLogs(logs)}`);
    }

    try {
      const response = await fetch(`${origin}/api/auth/me`);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for Next test server at ${origin}.\n${formatLogs(logs)}`);
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");

  const exited = await Promise.race([
    new Promise<boolean>((resolve) => {
      child.once("exit", () => resolve(true));
    }),
    new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), 5_000);
    })
  ]);

  if (!exited && child.exitCode === null) {
    child.kill("SIGKILL");
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
    });
  }
}

export async function startNextTestServer(input: {
  workdir: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): Promise<NextTestServer> {
  const port = await getAvailablePort();
  const origin = `http://127.0.0.1:${port}`;
  const nextCliPath = path.join(input.workdir, "node_modules", "next", "dist", "bin", "next");
  const logs: string[] = [];
  const timeoutMs = input.timeoutMs ?? 60_000;

  const child = spawn(
    process.execPath,
    [nextCliPath, "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: input.workdir,
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXT_TELEMETRY_DISABLED: "1",
        CI: "1",
        ...input.env
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  const capture = (chunk: string | Buffer) => {
    const text = String(chunk).trim();
    if (!text) {
      return;
    }

    logs.push(text);
    if (logs.length > 200) {
      logs.shift();
    }
  };

  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);

  try {
    await waitForServerReady(origin, child, logs, timeoutMs);
  } catch (error) {
    await stopChild(child);
    throw error;
  }

  return {
    origin,
    async stop() {
      await stopChild(child);
    }
  };
}

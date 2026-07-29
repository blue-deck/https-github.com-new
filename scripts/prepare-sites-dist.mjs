import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const openNextDirectory = path.join(projectDirectory, ".open-next");
const distDirectory = path.join(projectDirectory, "dist");
const serverDirectory = path.join(distDirectory, "server");
const clientDirectory = path.join(distDirectory, "client");
const workerEntry = path.join(serverDirectory, "index.js");
const wranglerEntry = path.join(
  projectDirectory,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);

async function assertFile(filePath) {
  const fileStat = await stat(filePath);

  if (!fileStat.isFile()) {
    throw new Error(`Expected a file at ${filePath}`);
  }
}

async function keepOnlyPublicCompiledEnvironment(filePath) {
  await assertFile(filePath);

  const compiledEnvironment = await import(
    `${pathToFileURL(filePath).href}?sanitize=${Date.now()}`
  );
  const modes = ["production", "development", "test"];
  const sanitizedSource = modes
    .map((mode) => {
      const values = Object.fromEntries(
        Object.entries(compiledEnvironment[mode] || {}).filter(([name]) =>
          name.startsWith("NEXT_PUBLIC_"),
        ),
      );

      return `export const ${mode} = ${JSON.stringify(values)};`;
    })
    .join("\n");

  await writeFile(filePath, `${sanitizedSource}\n`, "utf8");
}

async function createWorkerBundle() {
  const bundleDirectory = await mkdtemp(
    path.join(tmpdir(), "bluedeck-sites-worker-"),
  );

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [wranglerEntry, "deploy", "--dry-run", "--outdir", bundleDirectory],
        {
          cwd: projectDirectory,
          env: process.env,
          stdio: "inherit",
        },
      );

      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            signal
              ? `Wrangler bundling stopped with signal ${signal}`
              : `Wrangler bundling failed with exit code ${code}`,
          ),
        );
      });
    });

    const bundledWorker = path.join(bundleDirectory, "worker.js");
    await assertFile(bundledWorker);
    await cp(bundledWorker, workerEntry);
  } finally {
    await rm(bundleDirectory, { recursive: true, force: true });
  }
}

await assertFile(path.join(openNextDirectory, "worker.js"));
await assertFile(wranglerEntry);
await keepOnlyPublicCompiledEnvironment(
  path.join(openNextDirectory, "cloudflare", "next-env.mjs"),
);

await rm(distDirectory, { recursive: true, force: true });
await mkdir(serverDirectory, { recursive: true });
await createWorkerBundle();

await cp(path.join(openNextDirectory, "assets"), clientDirectory, {
  recursive: true,
});

await assertFile(workerEntry);

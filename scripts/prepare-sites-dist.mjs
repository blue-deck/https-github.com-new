import { cp, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const openNextDirectory = path.join(projectDirectory, ".open-next");
const distDirectory = path.join(projectDirectory, "dist");
const serverDirectory = path.join(distDirectory, "server");
const clientDirectory = path.join(distDirectory, "client");

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

await assertFile(path.join(openNextDirectory, "worker.js"));
await keepOnlyPublicCompiledEnvironment(
  path.join(openNextDirectory, "cloudflare", "next-env.mjs"),
);

await rm(distDirectory, { recursive: true, force: true });
await mkdir(serverDirectory, { recursive: true });

await cp(openNextDirectory, serverDirectory, {
  recursive: true,
  filter: (source) =>
    path.resolve(source) !== path.join(openNextDirectory, "assets"),
});

await rename(
  path.join(serverDirectory, "worker.js"),
  path.join(serverDirectory, "index.js"),
);

await cp(path.join(openNextDirectory, "assets"), clientDirectory, {
  recursive: true,
});

await assertFile(path.join(serverDirectory, "index.js"));

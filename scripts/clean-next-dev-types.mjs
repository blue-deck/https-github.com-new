import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const generatedDevTypesDirectory = path.resolve(
  scriptDirectory,
  "..",
  ".next",
  "dev",
  "types",
);

await rm(generatedDevTypesDirectory, { recursive: true, force: true });

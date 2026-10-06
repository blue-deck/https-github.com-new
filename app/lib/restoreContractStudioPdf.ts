import { parseLegacyStudioContract } from "./legacyContractStudio";
import { createContractStudioPdf } from "./contractStudioPdf";
import { getAugust2026ContractIntroduction } from "./contractStudioAugust2026";

// Template present in e78d24b (2026-08-01), before the retained legacy
// contracts were sent. Its introductory note is unchanged in 7c7a848.
// Match the saved clauses AND declarations before restoring that note;
// never substitute today's legal terms into an older agreement.
const august2026TemplateFingerprint = "869b483b3fe36179ac49210e785a5c7d3decefd5fff8594bb1b6cfd4c813e598";

export async function restoreContractStudioPdf(text: string, signature: string): Promise<Blob> {
  const input = parseLegacyStudioContract(text, signature);
  if (!input) {
    throw new Error("The saved Contract Studio document could not be restored. Please contact support.");
  }
  const recordedTemplate = [
    input.annexCClauses.flatMap((clause) => [`${clause.number}. ${clause.title}`, ...clause.body, ""]).join("\n").trim(),
    input.annexD.employerDeclarationParagraphs!.join("\n"),
    input.annexD.seafarerDeclarationParagraphs!.join("\n"),
  ].join("\n---\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(recordedTemplate));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return createContractStudioPdf({
    ...input,
    intro: fingerprint === august2026TemplateFingerprint ? getAugust2026ContractIntroduction() : undefined,
  });
}

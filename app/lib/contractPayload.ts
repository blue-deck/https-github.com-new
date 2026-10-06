const assignedContractPayloadKind = "bluedeck.assigned-contract";
export const maximumAssignedContractBytes = 1_048_576;

export type AssignedContractPayload = {
  contractText: string;
  employerSignatureDataUrl: string;
  pdfBase64: string;
  documentVersion: 0 | 1 | 2;
};

function validatePayloadSize(value: string) {
  if (new TextEncoder().encode(value).byteLength > maximumAssignedContractBytes) {
    throw new Error("This contract exceeds the document size limit. Please reduce the signature image or contract length and try again.");
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function validPdfBase64(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximumAssignedContractBytes) return false;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return false;
  try {
    const binary = atob(value);
    return binary.startsWith("%PDF-") && btoa(binary) === value;
  } catch {
    return false;
  }
}

export function isContractSignatureDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^data:image\/png;base64,[a-z0-9+/=]+$/i.test(value)
  );
}

export function serializeAssignedContractPayload(
  contractText: string,
  employerSignatureDataUrl: string,
) {
  if (!isContractSignatureDataUrl(employerSignatureDataUrl)) return contractText;

  return JSON.stringify({
    kind: assignedContractPayloadKind,
    version: 1,
    contractText,
    employerSignatureDataUrl,
  });
}

/** Capture the exact PDF that is sent; later template or profile edits cannot change it. */
export async function serializeAssignedContractPdfPayload(
  contractText: string,
  employerSignatureDataUrl: string,
  pdfBlob: Blob,
): Promise<string> {
  // Base64 and the surrounding JSON grow the stored payload. Reject a large
  // source before allocating another copy, then check the complete UTF-8 value.
  if (pdfBlob.size > maximumAssignedContractBytes * 3 / 4) {
    throw new Error("This contract exceeds the document size limit. Please reduce the signature image or contract length and try again.");
  }
  const pdfBase64 = bytesToBase64(new Uint8Array(await pdfBlob.arrayBuffer()));
  if (!validPdfBase64(pdfBase64)) {
    throw new Error("The contract PDF could not be prepared. Please try again.");
  }
  const value = JSON.stringify({
    kind: assignedContractPayloadKind,
    version: 2,
    contractText,
    employerSignatureDataUrl: isContractSignatureDataUrl(employerSignatureDataUrl)
      ? employerSignatureDataUrl
      : "",
    pdfBase64,
  });
  validatePayloadSize(value);
  return value;
}

export function parseAssignedContractPayload(value: unknown): AssignedContractPayload {
  const fallback: AssignedContractPayload = {
    contractText: typeof value === "string" ? value : "",
    employerSignatureDataUrl: "",
    pdfBase64: "",
    documentVersion: 0,
  };

  if (typeof value !== "string") return fallback;
  validatePayloadSize(value);
  if (!value.trim().startsWith("{")) return fallback;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(value) as Record<string, unknown>;
  } catch {
    if (value.includes(assignedContractPayloadKind)) {
      throw new Error("The saved contract document is damaged and cannot be opened.");
    }
    return fallback;
  }
  if (parsed.kind !== assignedContractPayloadKind) return fallback;
  if (typeof parsed.contractText !== "string" ||
      (parsed.version !== undefined && parsed.version !== 1 && parsed.version !== 2)) {
    throw new Error("The saved contract document format is not supported.");
  }
  if (parsed.version === 2 && (!validPdfBase64(parsed.pdfBase64) ||
      typeof parsed.employerSignatureDataUrl !== "string" ||
      (parsed.employerSignatureDataUrl !== "" && !isContractSignatureDataUrl(parsed.employerSignatureDataUrl)))) {
    // Never turn a damaged immutable PDF snapshot into a different document.
    throw new Error("The saved contract PDF is damaged and cannot be opened.");
  }

  return {
    contractText: parsed.contractText,
    employerSignatureDataUrl: isContractSignatureDataUrl(parsed.employerSignatureDataUrl)
      ? parsed.employerSignatureDataUrl
      : "",
    pdfBase64: parsed.version === 2 ? parsed.pdfBase64 as string : "",
    documentVersion: parsed.version === 2 ? 2 : 1,
  };
}

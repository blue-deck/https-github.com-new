const assignedContractPayloadKind = "bluedeck.assigned-contract";

export type AssignedContractPayload = {
  contractText: string;
  employerSignatureDataUrl: string;
};

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

export function parseAssignedContractPayload(value: unknown): AssignedContractPayload {
  const fallback = {
    contractText: typeof value === "string" ? value : "",
    employerSignatureDataUrl: "",
  };

  if (typeof value !== "string" || !value.trim().startsWith("{")) return fallback;

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      parsed.kind !== assignedContractPayloadKind ||
      typeof parsed.contractText !== "string"
    ) {
      return fallback;
    }

    return {
      contractText: parsed.contractText,
      employerSignatureDataUrl: isContractSignatureDataUrl(
        parsed.employerSignatureDataUrl,
      )
        ? parsed.employerSignatureDataUrl
        : "",
    };
  } catch {
    return fallback;
  }
}

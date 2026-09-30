export const CV_PDF_TIMEOUT_MS = 60_000;

export class CvPdfTimeoutError extends Error {
  constructor() {
    super("CV PDF generation took too long. Please try again.");
    this.name = "CvPdfTimeoutError";
  }
}

function cvPdfAbortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new Error("CV PDF generation was cancelled.");
}

export function assertCvPdfActive(signal: AbortSignal): void {
  if (signal.aborted) throw cvPdfAbortReason(signal);
}

export function awaitCvPdf<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    function settle(callback: () => void) {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      callback();
    }

    function onAbort() {
      settle(() => reject(cvPdfAbortReason(signal)));
    }

    // Consume late rejections even when the signal was aborted before this call.
    promise.then(
      (value) => settle(() => resolve(value)),
      (error) => settle(() => reject(error)),
    );
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

export async function runCvPdfJob<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = CV_PDF_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new CvPdfTimeoutError()), timeoutMs);

  try {
    return await awaitCvPdf(operation(controller.signal), controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

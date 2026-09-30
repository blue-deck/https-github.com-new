import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import {
  CV_PDF_TIMEOUT_MS,
  CvPdfTimeoutError,
  assertCvPdfActive,
  awaitCvPdf,
  runCvPdfJob,
} from "../app/lib/cvPdfAsync.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("a PDF job deadline aborts the operation with the same timeout error", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let operationSignal;
  let abortReason;
  const job = runCvPdfJob((signal) => {
    operationSignal = signal;
    signal.addEventListener("abort", () => { abortReason = signal.reason; }, { once: true });
    return new Promise(() => {});
  }, 100);
  const rejected = assert.rejects(job, (error) => {
    assert.ok(error instanceof CvPdfTimeoutError);
    assert.equal(error, abortReason);
    assert.equal(error.name, "CvPdfTimeoutError");
    return true;
  });

  context.mock.timers.tick(99);
  assert.equal(operationSignal.aborted, false);
  context.mock.timers.tick(1);
  await rejected;
  assert.equal(operationSignal.aborted, true);
  assert.equal(getEventListeners(operationSignal, "abort").length, 0);
});

test("normal job completion returns its result and clears the default deadline", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let operationSignal;
  const result = await runCvPdfJob(async (signal) => {
    operationSignal = signal;
    assertCvPdfActive(signal);
    return "pdf-ready";
  });

  assert.equal(result, "pdf-ready");
  context.mock.timers.tick(CV_PDF_TIMEOUT_MS + 1);
  assert.equal(operationSignal.aborted, false);
  assert.equal(getEventListeners(operationSignal, "abort").length, 0);
});

test("awaitCvPdf removes its listener after normal resolution or rejection", async () => {
  for (const rejectOperation of [false, true]) {
    const controller = new AbortController();
    const operation = deferred();
    const error = new Error("Image failed");
    const waiting = awaitCvPdf(operation.promise, controller.signal);
    assert.equal(getEventListeners(controller.signal, "abort").length, 1);

    if (rejectOperation) {
      const rejected = assert.rejects(waiting, (reason) => reason === error);
      operation.reject(error);
      await rejected;
    } else {
      operation.resolve("image-ready");
      assert.equal(await waiting, "image-ready");
    }
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  }
});

test("already-aborted signals reject with their original Error and leave no listener", async () => {
  const controller = new AbortController();
  const reason = new Error("PDF cancelled");
  controller.abort(reason);

  assert.throws(() => assertCvPdfActive(controller.signal), (error) => error === reason);
  await assert.rejects(
    awaitCvPdf(Promise.resolve("must-not-succeed"), controller.signal),
    (error) => error === reason,
  );
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("non-Error abort reasons become cancellation errors", async () => {
  const controller = new AbortController();
  controller.abort("cancelled");
  assert.throws(() => assertCvPdfActive(controller.signal), /CV PDF generation was cancelled/);
  await assert.rejects(
    awaitCvPdf(Promise.resolve(), controller.signal),
    /CV PDF generation was cancelled/,
  );
});

test("late completion after cancellation cannot call a success continuation", async () => {
  const controller = new AbortController();
  const operation = deferred();
  const reason = new Error("Cancelled before render completed");
  let successCalls = 0;
  const waiting = awaitCvPdf(operation.promise, controller.signal).then((value) => {
    successCalls += 1;
    return value;
  });
  const rejected = assert.rejects(waiting, (error) => error === reason);
  controller.abort(reason);
  await rejected;
  operation.resolve("late-pdf");
  await setImmediate();

  assert.equal(successCalls, 0);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("late rejections are consumed for newly aborted and already-aborted signals", async () => {
  for (const abortedBeforeCall of [false, true]) {
    const controller = new AbortController();
    const operation = deferred();
    const reason = new Error("Cancelled before image failed");
    if (abortedBeforeCall) controller.abort(reason);
    const waiting = awaitCvPdf(operation.promise, controller.signal);
    const rejected = assert.rejects(waiting, (error) => error === reason);
    if (!abortedBeforeCall) controller.abort(reason);
    await rejected;
    operation.reject(new Error("Late image rejection"));
    // node:test reports an unhandled rejection if the cancelled job leaked it.
    await setImmediate();
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  }
});

for (const asynchronous of [false, true]) {
  test(`${asynchronous ? "rejected" : "synchronously thrown"} operations clear their deadline`, async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    let operationSignal;
    const reason = new Error("Render failed");
    const job = runCvPdfJob((signal) => {
      operationSignal = signal;
      if (asynchronous) return Promise.reject(reason);
      throw reason;
    }, 100);

    await assert.rejects(job, (error) => error === reason);
    context.mock.timers.tick(101);
    assert.equal(operationSignal.aborted, false);
    assert.equal(getEventListeners(operationSignal, "abort").length, 0);
  });
}

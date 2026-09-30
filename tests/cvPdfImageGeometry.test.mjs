import assert from "node:assert/strict";
import test from "node:test";
import { cvPdfCoverRect } from "../app/lib/cvPdfImageGeometry.ts";

test("a landscape portrait photo fills its square frame without squeezing its face", () => {
  assert.deepEqual(cvPdfCoverRect(1600, 800, { x: 20, y: 40, width: 35, height: 35 }), {
    x: 2.5, y: 40, width: 70, height: 35,
  });
});

test("a tall portrait keeps its aspect ratio and crops equally above and below the frame", () => {
  assert.deepEqual(cvPdfCoverRect(800, 1600, { x: 20, y: 40, width: 35, height: 35 }), {
    x: 20, y: 22.5, width: 35, height: 70,
  });
});

test("a square photo matches the avatar content frame exactly", () => {
  assert.deepEqual(cvPdfCoverRect(1200, 1200, { x: 20, y: 40, width: 35, height: 35 }), {
    x: 20, y: 40, width: 35, height: 35,
  });
});

test("landscape yacht frames center a portrait source rather than stretch it", () => {
  assert.deepEqual(cvPdfCoverRect(600, 1200, { x: 0, y: 0, width: 600, height: 400 }), {
    x: 0, y: -400, width: 600, height: 1200,
  });
});

test("cover geometry preserves source ratio, frame coverage, and center across page units", () => {
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
  for (const [sourceWidth, sourceHeight] of [[1, 1], [3, 2], [2, 3], [4032, 3024], [3024, 4032]]) {
    for (const box of [
      { x: 20.25, y: 40.75, width: 35.125, height: 35.125 },
      { x: -25.25, y: -0.25, width: 600.5, height: 400.75 },
      { x: 0, y: 0, width: 0.1, height: 0.25 },
    ]) {
      const rect = cvPdfCoverRect(sourceWidth, sourceHeight, box);
      near(rect.width / rect.height, sourceWidth / sourceHeight);
      near(rect.x + rect.width / 2, box.x + box.width / 2);
      near(rect.y + rect.height / 2, box.y + box.height / 2);
      assert.ok(rect.x <= box.x + 1e-8 && rect.y <= box.y + 1e-8);
      assert.ok(rect.x + rect.width >= box.x + box.width - 1e-8);
      assert.ok(rect.y + rect.height >= box.y + box.height - 1e-8);
      assert.ok(Math.abs(rect.width - box.width) < 1e-8 || Math.abs(rect.height - box.height) < 1e-8);
    }
  }
});

test("cover placement never mutates the measured print frame", () => {
  const box = Object.freeze({ x: 12, y: 24, width: 35, height: 35 });
  cvPdfCoverRect(900, 1200, box);
  assert.deepEqual(box, { x: 12, y: 24, width: 35, height: 35 });
});

test("zero, negative and non-finite image or frame dimensions fail before drawing", () => {
  for (const invalid of [0, -1, NaN, Infinity, -Infinity]) {
    for (const argument of ["sourceWidth", "sourceHeight", "width", "height"]) {
      const values = { sourceWidth: 800, sourceHeight: 1200, x: 0, y: 0, width: 35, height: 35, [argument]: invalid };
      assert.throws(() => cvPdfCoverRect(values.sourceWidth, values.sourceHeight, values), /CV image dimensions/);
    }
  }
});

test("non-finite frame positions fail before corrupting PDF coordinates", () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    for (const coordinate of ["x", "y"]) {
      assert.throws(
        () => cvPdfCoverRect(1200, 1200, { x: 0, y: 0, width: 35, height: 35, [coordinate]: invalid }),
        /CV image dimensions/,
      );
    }
  }
});

test("unrepresentable cover geometry fails instead of returning infinite PDF coordinates", () => {
  assert.throws(
    () => cvPdfCoverRect(Number.MIN_VALUE, Number.MAX_VALUE, { x: 0, y: 0, width: 35, height: 35 }),
    /CV image placement/,
  );
});

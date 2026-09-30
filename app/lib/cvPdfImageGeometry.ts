export type CvPdfImageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Place an image with a centered cover crop in CSS pixels, PDF units, or canvas pixels. */
export function cvPdfCoverRect(
  sourceWidth: number,
  sourceHeight: number,
  box: CvPdfImageRect,
): CvPdfImageRect {
  const dimensions = [sourceWidth, sourceHeight, box.width, box.height];
  if (
    dimensions.some((value) => !Number.isFinite(value) || value <= 0)
    || !Number.isFinite(box.x)
    || !Number.isFinite(box.y)
  ) {
    throw new Error("CV image dimensions must be positive and coordinates must be finite.");
  }

  const scale = Math.max(box.width / sourceWidth, box.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const rect = {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
  if (Object.values(rect).some((value) => !Number.isFinite(value)) || width <= 0 || height <= 0) {
    throw new Error("CV image placement exceeds the supported dimensions.");
  }
  return rect;
}

import { fittedSize } from "@/lib/image-size";

const FULL = 1600;
const CARD = 800;
const QUALITY = 0.8;

function draw(bitmap: ImageBitmap, max: number) {
  const size = fittedSize(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the photo");
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare the photo"))),
      "image/webp",
      QUALITY,
    );
  });
}

/** WebP copies for the product page and the shop grid. The original file is left untouched. */
export async function compressProductPhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const [full, card] = await Promise.all([draw(bitmap, FULL), draw(bitmap, CARD)]);
    return { full, card };
  } finally {
    bitmap.close();
  }
}

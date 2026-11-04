export type ImageUploadPayload = { name: string; type: "image/jpeg" | "image/png" | "image/webp"; base64: string };

/** Read a photo for a server-function upload (JPG/PNG/WebP up to 5 MB). */
export async function imageFileToUpload(file: File): Promise<ImageUploadPayload> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5_000_000) {
    throw new Error("Use a JPG, PNG or WebP photo under 5MB");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { name: file.name, type: file.type as ImageUploadPayload["type"], base64: btoa(binary) };
}

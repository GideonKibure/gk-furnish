function extensionOf(source: string | File) {
  if (source instanceof File) {
    const fromName = source.name.split(".").pop()?.toLowerCase() ?? "";
    if (/^(jpe?g|png|webp|gif|avif|mp4|webm)$/.test(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
    if (source.type === "image/png") return "png";
    if (source.type === "image/webp") return "webp";
    if (source.type === "image/gif") return "gif";
    if (source.type === "video/webm") return "webm";
    if (source.type === "video/mp4") return "mp4";
    return "jpg";
  }
  const clean = source.split("?")[0] ?? "";
  const ext = clean.split(".").pop()?.toLowerCase() ?? "";
  if (/^(jpe?g|png|webp|gif|avif|mp4|webm)$/.test(ext)) return ext === "jpeg" ? "jpg" : ext;
  return "jpg";
}

export function photoFileName(base: string, source: string | File) {
  const safe = base
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "photo";
  return `${safe}.${extensionOf(source)}`;
}

function extensionFromMime(mime: string) {
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/jpeg") return "jpg";
  return null;
}

/** Save a photo or video the admin already has, or one stored for the shop, onto this device. */
export async function downloadToDevice(source: string | File, filename: string) {
  const blob = source instanceof File ? source : await (await fetch(source)).blob();
  const fromMime = extensionFromMime(blob.type);
  const current = filename.split(".").pop()?.toLowerCase();
  const finalName = fromMime && current !== fromMime ? filename.replace(/\.[^.]+$/, `.${fromMime}`) : filename;
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = finalName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1500);
}

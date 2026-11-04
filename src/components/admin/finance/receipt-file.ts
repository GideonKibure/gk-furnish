export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export type ReceiptUploadPayload = {
  name: string;
  type: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  base64: string;
};

/** Read a receipt (JPG, PNG, WebP or PDF up to 5 MB) for a server-function upload. */
export async function receiptFileToUpload(file: File): Promise<ReceiptUploadPayload> {
  if (!RECEIPT_ACCEPT.split(",").includes(file.type) || file.size > 5_000_000) {
    throw new Error("Use a JPG, PNG, WebP or PDF receipt under 5MB");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { name: file.name, type: file.type as ReceiptUploadPayload["type"], base64: btoa(binary) };
}

/**
 * Open a private file in a new tab. The tab is opened before the signed URL is fetched so
 * pop-up blockers treat it as part of the click.
 */
export async function openSignedUrl(getUrl: () => Promise<{ url: string }>) {
  const tab = window.open("", "_blank");
  try {
    const { url } = await getUrl();
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (err) {
    tab?.close();
    throw err;
  }
}

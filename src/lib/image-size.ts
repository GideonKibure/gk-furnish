/** Fit a photo inside a square of `max` pixels without enlarging it. */
export function fittedSize(width: number, height: number, max: number) {
  const longest = Math.max(width, height, 1);
  const scale = Math.min(1, max / longest);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Grid URL for a WebP we stored beside the full photo. Other files stay as they are. */
export function cardVariantUrl(url: string) {
  if (!url.includes("/product-images/")) return url;
  if (/-w800\.webp(?:\?|#|$)/.test(url)) return url;
  if (!/\.webp(?:\?|#|$)/.test(url)) return url;
  return url.replace(/\.webp(?=\?|#|$)/, "-w800.webp");
}

/** 800px sibling plus the full file, when that sibling is a real stored photo. */
export function cardSrcSet(url: string) {
  const small = cardVariantUrl(url);
  if (small === url) return null;
  return `${small} 800w, ${url} 1600w`;
}

export function securityHeaders(host: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "frame-ancestors 'self'",
  };
  if (host === "gkfurnish.co.tz") {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}

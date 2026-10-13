/** Small finish images for colour selection. Known names get a fixed swatch; others get a stable colour. */

const NAMED: Record<string, [string, string, boolean]> = {
  "natural wood": ["#f0d2a8", "#b8884f", true],
  "dark walnut": ["#6b4423", "#2e1a0e", true],
  "dark brown": ["#6a3e24", "#3a2214", true],
  "navy seat": ["#2a4a73", "#14213d", false],
  navy: ["#2a4a73", "#14213d", false],
  "cream seat": ["#f7f1e6", "#e4d5bc", false],
  cream: ["#f7f1e6", "#e4d5bc", false],
  white: ["#fbfbfb", "#e6e6e6", false],
  black: ["#3a3a3a", "#141414", false],
  "your choice": ["#e8d7b0", "#14213d", false],
};

function svg(a: string, b: string, grain: boolean) {
  const lines = grain
    ? `<g stroke="${b}" stroke-opacity="0.28" fill="none" stroke-width="1"><path d="M0 10h64M0 22h64M0 36h64M0 50h64"/></g>`
    : "";
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/>${lines}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(xml)}`;
}

function hashColor(name: string) {
  let n = 0;
  for (const ch of name) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = n % 360;
  return svg(`hsl(${hue} 42% 62%)`, `hsl(${hue} 38% 38%)`, hue < 50 || hue > 320);
}

export function colorSwatch(name: string) {
  const known = NAMED[name.trim().toLowerCase()];
  if (known) return svg(known[0], known[1], known[2]);
  return hashColor(name);
}

export const STANDARD_COLORS = [
  "Natural wood",
  "Dark walnut",
  "Navy",
  "Cream",
  "Black",
  "White",
] as const;

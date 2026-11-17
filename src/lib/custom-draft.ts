export type CustomDraft = {
  step: 1 | 2 | 3 | 4;
  furnitureType: string;
  description: string;
  quantity: string;
  dimensions: string;
  materialNote: string;
  colorNote: string;
  materials: string[];
  colors: string[];
  budget: string;
  neededBy: string;
  finish: string;
  requirements: string;
  fullName: string;
  phone: string;
  email: string;
  location: string;
  startedAt: number;
};

export function moveCustomStep(step: number, direction: "next" | "back"): 1 | 2 | 3 | 4 {
  const next = direction === "next" ? step + 1 : step - 1;
  if (next < 1) return 1;
  if (next > 4) return 4;
  return next as 1 | 2 | 3 | 4;
}

export function parseCustomDraft(raw: string | null): CustomDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CustomDraft>;
    if (value.step !== 1 && value.step !== 2 && value.step !== 3 && value.step !== 4) return null;
    if (typeof value.startedAt !== "number") return null;
    const text = (item: unknown) => (typeof item === "string" ? item : "");
    const list = (item: unknown) => (Array.isArray(item) ? item.filter((entry): entry is string => typeof entry === "string") : []);
    return {
      step: value.step,
      furnitureType: text(value.furnitureType),
      description: text(value.description),
      quantity: text(value.quantity) || "1",
      dimensions: text(value.dimensions),
      materialNote: text(value.materialNote),
      colorNote: text(value.colorNote),
      materials: list(value.materials),
      colors: list(value.colors),
      budget: text(value.budget),
      neededBy: text(value.neededBy),
      finish: text(value.finish),
      requirements: text(value.requirements),
      fullName: text(value.fullName),
      phone: text(value.phone),
      email: text(value.email),
      location: text(value.location),
      startedAt: value.startedAt,
    };
  } catch {
    return null;
  }
}

export function serialiseCustomDraft(draft: CustomDraft) {
  return JSON.stringify(draft);
}

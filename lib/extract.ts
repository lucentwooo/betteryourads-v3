export const DEFAULT_MODEL = "anthropic/claude-3.7-sonnet";

export function isValidHttpUrl(input: string): boolean {
  try {
    const u = new URL(input.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveModel(envValue: string | undefined): string {
  const v = (envValue ?? "").trim();
  return v.length > 0 ? v : DEFAULT_MODEL;
}

export function buildModelSlug(model: string): string {
  return model.endsWith(":online") ? model : `${model}:online`;
}

export interface ExtractJsonResult {
  json: unknown | null;
  raw: string;
  parseError: boolean;
}

export function extractJson(text: string): ExtractJsonResult {
  const raw = text;
  let candidate = text.trim();
  // Strip a leading ```json / ``` fence and trailing ``` if present.
  const fenced = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    candidate = fenced[1].trim();
  }
  try {
    return { json: JSON.parse(candidate), raw, parseError: false };
  } catch {
    return { json: null, raw, parseError: true };
  }
}

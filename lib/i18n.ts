import en from "@/messages/en.json";
import th from "@/messages/th.json";

export type Dictionary = typeof en;
export type Locale = "en" | "th";

function merge(base: Dictionary, extra: Record<string, unknown>): Dictionary {
  const output: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = output[key];
    if (value && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object") {
      output[key] = merge(current as Dictionary, value as Record<string, unknown>);
    } else if (typeof value === "string") {
      output[key] = value;
    }
  }
  return output as Dictionary;
}

export function dictionaryFor(locale: string): Dictionary {
  return locale === "th" ? merge(en, th as unknown as Record<string, unknown>) : en;
}

export function translate(
  dict: Dictionary,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const node = key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
  if (typeof node !== "string") return key;
  return node.replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? ""));
}

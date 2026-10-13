/**
 * Prompt Arena — czysta logika (bez DOM): parsowanie odpowiedzi API,
 * metryki, walidacja konfiguracji, eksport Markdown.
 */

export interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export interface ParsedAnswer {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

/** Bezpieczne wyciągnięcie odpowiedzi z formatu OpenAI-compatible. */
export function parseChatResponse(data: unknown): ParsedAnswer {
  const d = (data ?? {}) as ChatResponse;
  const text = d.choices?.[0]?.message?.content ?? "";
  return {
    text,
    tokensIn: d.usage?.prompt_tokens ?? 0,
    tokensOut: d.usage?.completion_tokens ?? 0,
  };
}

export interface FighterConfig {
  name: string;
  /** endpoint OpenAI-compatible, np. http://localhost:11434/v1 */
  endpoint: string;
  model: string;
  /** pusty = bez autoryzacji (Ollama lokalnie) */
  apiKey: string;
}

/** Walidacja konfiguracji zawodnika; zwraca listę błędów. */
export function validateFighter(f: FighterConfig): string[] {
  const errors: string[] = [];
  if (!f.name.trim()) errors.push("nazwa jest pusta");
  if (!/^https?:\/\//.test(f.endpoint.trim())) errors.push("endpoint musi zaczynać się od http(s)://");
  if (!f.model.trim()) errors.push("model jest pusty");
  return errors;
}

/** Normalizuje endpoint do bazowego URL (ucina końcowy /chat/completions i ukośnik). */
export function normalizeEndpoint(endpoint: string): string {
  return endpoint
    .trim()
    .replace(/\/chat\/completions\/?$/i, "")
    .replace(/\/+$/, "");
}

export interface RunRecord {
  id: number;
  prompt: string;
  results: Array<{
    name: string;
    ok: boolean;
    text: string;
    latencyMs: number;
    tokensOut: number;
    error?: string;
  }>;
}

/** Zwycięzca rundy wg priorytetu: odpowiedź OK → mniej tokenów → szybciej. */
export function pickWinner(record: RunRecord): string | null {
  const ok = record.results.filter((r) => r.ok);
  if (ok.length < 2) return null;
  const sorted = [...ok].sort((a, b) => a.tokensOut - b.tokensOut || a.latencyMs - b.latencyMs);
  return sorted[0].name;
}

/** Eksport historii do Markdown. */
export function exportMarkdown(history: RunRecord[]): string {
  const lines: string[] = ["# Prompt Arena — historia walk", ""];
  for (const h of history) {
    lines.push(`## Runda ${h.id}`);
    lines.push("");
    lines.push("```");
    lines.push(h.prompt);
    lines.push("```");
    lines.push("");
    for (const r of h.results) {
      lines.push(
        r.ok
          ? `- **${r.name}** — ${r.latencyMs} ms, ${r.tokensOut} tok. wyj.`
          : `- **${r.name}** — BŁĄD: ${r.error ?? "?"}`,
      );
    }
    const w = pickWinner(h);
    if (w) lines.push(`\n→ Rundy wygrywa: **${w}** (mniej tokenów / szybciej)`);
    lines.push("");
  }
  return lines.join("\n");
}

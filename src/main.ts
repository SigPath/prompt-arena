import { parseChatResponse, normalizeEndpoint, validateFighter, exportMarkdown, pickWinner, type FighterConfig, type RunRecord } from './logic.ts';
import './style.css';

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;

function readFighter(sel: string): FighterConfig {
  const root = $(sel);
  const get = (k: string) => (root.querySelector(`[data-f="${k}"]`) as HTMLInputElement).value;
  return { name: get('name'), endpoint: get('endpoint'), model: get('model'), apiKey: get('key') };
}

async function chat(f: FighterConfig, system: string, user: string): Promise<{ text: string; tokensOut: number; latencyMs: number }> {
  const t0 = performance.now();
  const res = await fetch(`${normalizeEndpoint(f.endpoint)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(f.apiKey ? { Authorization: `Bearer ${f.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: f.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} — ${body.slice(0, 160)}`);
  }
  const parsed = parseChatResponse(await res.json());
  return {
    text: parsed.text || '(pusta odpowiedź)',
    tokensOut: parsed.tokensOut,
    latencyMs: Math.round(performance.now() - t0),
  };
}

const history: RunRecord[] = [];
let roundId = 0;

function renderResult(sel: 'A' | 'B', name: string, r?: { text: string; latencyMs: number; tokensOut: number }, error?: string): void {
  const box = $(`#res-${sel.toLowerCase()}`);
  (box.querySelector('h3') as HTMLElement).textContent = name;
  const metrics = box.querySelector('.metrics') as HTMLElement;
  const out = box.querySelector('.out') as HTMLElement;
  if (error) {
    metrics.textContent = 'BŁĄD';
    metrics.classList.add('err');
    out.textContent = error;
  } else if (r) {
    metrics.classList.remove('err');
    metrics.textContent = `${r.latencyMs} ms · ${r.tokensOut} tok. wyj.`;
    out.textContent = r.text;
  }
}

function renderHistory(): void {
  const ol = $('#history');
  ol.innerHTML = '';
  for (const h of history) {
    const li = document.createElement('li');
    const w = pickWinner(h);
    const parts = h.results.map((r) => r.ok ? `${r.name}: ${r.latencyMs}ms/${r.tokensOut}tok` : `${r.name}: BŁĄD`);
    li.textContent = `R${h.id} — ${parts.join(' vs ')}${w ? ` → 🏆 ${w}` : ''}`;
    ol.appendChild(li);
  }
  ($('#export') as HTMLButtonElement).disabled = history.length === 0;
}

$('#run').addEventListener('click', async () => {
  const a = readFighter('#f-a');
  const b = readFighter('#f-b');
  const errs = [...validateFighter(a), ...validateFighter(b)];
  if (errs.length) {
    $('#status').textContent = 'Błędy konfiguracji: ' + errs.join('; ');
    return;
  }
  const system = ($('#system') as HTMLInputElement).value;
  const user = ($('#user') as HTMLTextAreaElement).value;
  const btn = $('#run') as HTMLButtonElement;
  btn.disabled = true;
  $('#status').textContent = 'Walka trwa…';

  renderResult('A', a.name, undefined, undefined);
  renderResult('B', b.name);
  const round: RunRecord = { id: ++roundId, prompt: user, results: [] };

  const safe = async (f: FighterConfig) => {
    try {
      const r = await chat(f, system, user);
      return { ...r, ok: true as const };
    } catch (e) {
      return { text: '', latencyMs: 0, tokensOut: 0, ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  };

  const [ra, rb] = await Promise.all([safe(a), safe(b)]);

  if (ra.ok) { renderResult('A', a.name, ra); round.results.push({ name: a.name, ok: true, text: ra.text, latencyMs: ra.latencyMs, tokensOut: ra.tokensOut }); }
  else { renderResult('A', a.name, undefined, ra.error); round.results.push({ name: a.name, ok: false, text: '', latencyMs: 0, tokensOut: 0, error: ra.error }); }
  if (rb.ok) { renderResult('B', b.name, rb); round.results.push({ name: b.name, ok: true, text: rb.text, latencyMs: rb.latencyMs, tokensOut: rb.tokensOut }); }
  else { renderResult('B', b.name, undefined, rb.error); round.results.push({ name: b.name, ok: false, text: '', latencyMs: 0, tokensOut: 0, error: rb.error }); }

  history.unshift(round);
  renderHistory();
  const w = pickWinner(round);
  $('#status').textContent = w ? `Runda ${round.id} rozstrzygnięta — 🏆 ${w}` : `Runda ${round.id} zapisana.`;
  btn.disabled = false;
});

$('#export').addEventListener('click', () => {
  const blob = new Blob([exportMarkdown(history)], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'prompt-arena-historia.md';
  a.click();
  URL.revokeObjectURL(url);
});

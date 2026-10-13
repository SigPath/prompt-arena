import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChatResponse,
  validateFighter,
  normalizeEndpoint,
  pickWinner,
  exportMarkdown,
  type RunRecord,
} from '../src/logic.ts';

test('parseChatResponse: pełna odpowiedź z usage', () => {
  const p = parseChatResponse({
    choices: [{ message: { content: 'Cześć!' } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  });
  assert.equal(p.text, 'Cześć!');
  assert.equal(p.tokensIn, 10);
  assert.equal(p.tokensOut, 5);
});

test('parseChatResponse: puste/pśnie pola nie wywalają', () => {
  assert.deepEqual(parseChatResponse(null), { text: '', tokensIn: 0, tokensOut: 0 });
  assert.deepEqual(parseChatResponse({}), { text: '', tokensIn: 0, tokensOut: 0 });
});

test('validateFighter: kompletne configy przechodzą', () => {
  const errs = validateFighter({ name: 'A', endpoint: 'http://localhost:11434/v1', model: 'llama3.2', apiKey: '' });
  assert.deepEqual(errs, []);
});

test('validateFighter: złe pola są raportowane', () => {
  const errs = validateFighter({ name: '  ', endpoint: 'localhost/bez-http', model: '', apiKey: '' });
  assert.equal(errs.length, 3);
});

test('normalizeEndpoint: ucina suffix i ukośniki', () => {
  assert.equal(normalizeEndpoint('http://x/v1/'), 'http://x/v1');
  assert.equal(normalizeEndpoint('http://x/v1/chat/completions'), 'http://x/v1');
  assert.equal(normalizeEndpoint('  http://x  '), 'http://x');
});

const round: RunRecord = {
  id: 1,
  prompt: 'p',
  results: [
    { name: 'A', ok: true, text: 'x', latencyMs: 900, tokensOut: 40 },
    { name: 'B', ok: true, text: 'y', latencyMs: 300, tokensOut: 40 },
    { name: 'C', ok: false, text: '', latencyMs: 0, tokensOut: 0, error: 'HTTP 500' },
  ],
};

test('pickWinner: remis tokenów decyduje latencja; błąd dyskwalifikuje', () => {
  assert.equal(pickWinner(round), 'B');
});

test('pickWinner: mniej tokenów wygrywa mimo wolniejszej latencji', () => {
  const r: RunRecord = {
    id: 2,
    prompt: 'p',
    results: [
      { name: 'Szybki', ok: true, text: 'x', latencyMs: 100, tokensOut: 500 },
      { name: 'Ekonomiczny', ok: true, text: 'y', latencyMs: 2000, tokensOut: 10 },
    ],
  };
  assert.equal(pickWinner(r), 'Ekonomiczny');
});

test('pickWinner: null przy mniejszej liczbie sprawnych', () => {
  assert.equal(pickWinner({ id: 3, prompt: '', results: round.results.slice(0, 1) }), null);
});

test('exportMarkdown: zawiera rundy, metryki i zwycięzcę', () => {
  const md = exportMarkdown([round]);
  assert.match(md, /## Runda 1/);
  assert.match(md, /\*\*B\*\* — 300 ms, 40 tok/);
  assert.match(md, /BŁĄD: HTTP 500/);
  assert.match(md, /wygrywa: \*\*B\*\*/);
});

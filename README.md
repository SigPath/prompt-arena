# Prompt Arena

**Pojedynek promptów**: ten sam prompt do dwóch modeli OpenAI-compatible, obok siebie,
z metrykami (latencja, tokeny wyjściowe) i eksportem historii do Markdown.

→ **Demo:** https://sigpath.github.io/prompt-arena/ (do realnych walk potrzebny Ollama lokalnie albo klucz API — BYOK)

## Dlaczego tak

- **BYOK** — klucz API wpisujesz sam, trzyma go `localStorage` Twojej przeglądarki;
  nic nie przechodzi przez żaden serwer pośredniczący,
- **dowolny endpoint OpenAI-compatible**: Ollama (`http://localhost:11434/v1`), OpenRouter,
  vLLM, LM Studio, własne proxy,
- werdykt rundy: mniej tokenów → szybciej; błąd dyskwalifikuje,
- historia rund + eksport do Markdown (wklej do notatek/PR-a).

## Szybki start

```bash
npm install
npm run dev     # development
npm test        # 9 testów logiki (parsowanie, walidacja, werdykt, eksport)
npm run build
```

Do walki z lokalnym modelem: `OLLAMA_ORIGINS=* ollama serve` + `ollama pull llama3.2`
(nagłówek CORS — inaczej przeglądarka zablokuje zapytanie do `localhost:11434`).

## Ograniczenia (uczciwie)

- OpenAI bezpośrednio z przeglądarki blokuje CORS — użyj OpenRouter / Ollamy / proxy,
- „sędzia" to na razie człowiek + metryki ilościowe; LLM-as-judge w planach,
- streaming odpowiedzi nie jest zaimplementowany (celowo: metryki liczone na pełnej odpowiedzi).

## Licencja

MIT

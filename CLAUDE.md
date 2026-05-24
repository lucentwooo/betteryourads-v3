# Brand DNA Extractor

A Next.js (App Router) web app that takes a SaaS website URL and returns a
structured "Brand DNA" JSON profile — brand identity, visual system, offer DNA,
messaging, proof, competitor intel, and 5 static ad concepts — for generating
Meta ads.

## How it works

1. The user enters a website URL on the home page (`app/page.tsx`) and clicks Extract.
2. The client POSTs `{ url }` to `app/api/extract/route.ts`.
3. The route sends the Brand DNA prompt (system) + URL (user) to a **web-enabled**
   OpenRouter model (`<model>:online`) with streaming, and pipes the text back.
4. The client strips code fences, parses the JSON, and offers Copy / Download.

The OpenRouter API key lives only on the server as an env var; it is never sent to
the browser.

## Source of truth

- `lib/brandDnaPrompt.ts` holds the extraction prompt and is the source of truth for
  the model's instructions and the output JSON schema.
- `Extract Brand DNA Prompt - Copy.txt` is the original human-readable copy. If you
  change the prompt, update **both** files.

## Environment variables

| Var                  | Required | Purpose                                                        |
|----------------------|----------|----------------------------------------------------------------|
| `OPENROUTER_API_KEY` | Yes      | Server-side OpenRouter key. Never exposed to the browser.      |
| `OPENROUTER_MODEL`   | No       | Model slug without `:online`. Defaults to `anthropic/claude-3.7-sonnet`. |

Copy `.env.example` to `.env.local` and fill in your key for local development.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run build    # production build
```

## Deploy (Vercel)

1. Push the repo to GitHub and import it in Vercel.
2. In Project Settings → Environment Variables, set `OPENROUTER_API_KEY` (and
   optionally `OPENROUTER_MODEL`).
3. Deploy. To change the model later, edit `OPENROUTER_MODEL` and redeploy.
4. **Timeout note:** the extraction route sets `maxDuration = 300` (5 min) because a
   full extraction can take a while. Vercel's **Hobby (free) plan caps functions at
   60s** — long extractions will be cut off. Use a **Pro plan** for the full 300s, or
   lower `maxDuration` in `app/api/extract/route.ts` if you stay on Hobby.

## Architecture

```
app/page.tsx              UI: URL field + Extract + result viewer (Copy / Download)
app/api/extract/route.ts  Server route: holds key, calls OpenRouter, streams text back
lib/brandDnaPrompt.ts     The extraction prompt (source of truth in code)
lib/extract.ts            Pure helpers: isValidHttpUrl, resolveModel, buildModelSlug, extractJson
```

## Known limitations (v1)

- No auth, database, or run history.
- No rate limiting: because the key is server-side, every run spends the owner's
  OpenRouter credit. Add a password gate or rate limiting before sharing widely.

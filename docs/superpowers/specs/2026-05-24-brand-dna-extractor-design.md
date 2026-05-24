# Brand DNA Extractor — Design Spec

**Date:** 2026-05-24
**Status:** Approved for implementation

## Summary

A hosted web app that takes a SaaS website URL, runs the existing "Brand DNA"
extraction prompt against it using a web-enabled model on OpenRouter, and returns
a structured JSON creative-intelligence profile. The profile can be viewed,
copied, and downloaded as a `.json` file.

The extraction prompt already exists in `Extract Brand DNA Prompt - Copy.txt` and
is the source of truth for the model's instructions and output schema.

## Goals

- Enter a website URL, click Extract, get the Brand DNA JSON back.
- Model does the browsing itself (web-enabled `:online` model on OpenRouter), so
  no separate scraping step is needed.
- Hosted for others to use; the OpenRouter API key stays server-side and is never
  exposed to the browser.
- Deployable to Vercel with minimal configuration.

## Non-Goals (v1)

- No accounts, auth, or login.
- No database / no history of past runs.
- No rate limiting or billing controls. **Accepted tradeoff:** because the key is
  server-side, a public deploy spends the owner's OpenRouter credit on every run.
  Worth adding basic protection later; out of scope for v1.
- No in-app model picker (model is configured via env var instead).

## User Flow

1. User opens the page, enters a website URL, clicks **Extract**.
2. Frontend POSTs `{ url }` to `/api/extract`.
3. The API route calls OpenRouter with the configured web-enabled model
   (`<model>:online`), sending the Brand DNA prompt as the system message and the
   URL as the user message.
4. The model browses the site and produces the structured JSON.
5. The API streams the response back; the frontend shows progress, then renders the
   JSON with **Copy** and **Download `.json`** buttons.

## Architecture

Next.js (App Router) deployed on Vercel.

```
/app
  page.tsx                 # UI: URL field + Extract button + result viewer
  /api/extract/route.ts    # server route: holds key, calls OpenRouter, streams back
/lib
  brandDnaPrompt.ts        # the extraction prompt text (single source of truth in code)
CLAUDE.md                  # project documentation
Extract Brand DNA Prompt - Copy.txt   # original prompt, kept as reference
.env.local                 # OPENROUTER_API_KEY, OPENROUTER_MODEL (gitignored)
.env.example               # documents the env vars
```

### API route (`/app/api/extract/route.ts`)

- Reads `OPENROUTER_API_KEY` from env; returns a clear error if missing.
- Reads `OPENROUTER_MODEL` from env; falls back to a sensible default if unset.
- Validates the incoming `url` is a valid `http`/`https` URL; rejects otherwise.
- Calls `POST https://openrouter.ai/api/v1/chat/completions` with:
  - `model: "<OPENROUTER_MODEL>:online"` (enables web browsing)
  - `stream: true`
  - `messages`: system = Brand DNA prompt, user = the URL
- Requests JSON output and strips any markdown code fences from the result.
- If the final text does not parse as JSON, still returns the raw text plus an
  error flag so nothing is lost.
- `export const maxDuration = 300` — the prompt and output are large, so a long
  timeout plus streaming keeps the page from looking dead during a long run.

### Configuration (env vars)

| Var                  | Required | Purpose                                              |
|----------------------|----------|------------------------------------------------------|
| `OPENROUTER_API_KEY` | Yes      | Server-side OpenRouter key. Never sent to browser.   |
| `OPENROUTER_MODEL`   | No       | Model slug (without `:online`). Has a default.       |

Changing the model = edit `OPENROUTER_MODEL` and redeploy. No UI control.

### Frontend (`/app/page.tsx`)

Single page:
- URL input field with basic validation.
- **Extract** button (disabled while a run is in progress).
- A status/progress line shown while the response streams.
- A pretty-printed JSON panel once complete, with **Copy** and **Download `.json`**
  buttons.
- A clear error message if the run fails.

Clean, minimal styling.

### Prompt source of truth

The prompt text lives in `/lib/brandDnaPrompt.ts` as an exported string, copied
verbatim from `Extract Brand DNA Prompt - Copy.txt`. The original `.txt` is kept in
the repo as the human-readable reference. If the prompt changes, update both.

## Error Handling

- Missing `OPENROUTER_API_KEY` → 500 with a clear server message.
- Invalid/empty URL → 400, surfaced in the UI.
- OpenRouter request failure (non-2xx, network) → error surfaced in the UI.
- Model returns non-JSON → return raw text + `parseError: true`; UI shows the raw
  text and a note that JSON parsing failed.

## CLAUDE.md Contents

- What the project is and does.
- That `brandDnaPrompt.ts` (mirrored from the `.txt`) is the source of truth for the
  extraction logic and output schema.
- Env vars (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) and their defaults.
- How to run locally (`npm install`, `npm run dev`).
- How to deploy to Vercel (set env vars in project settings).
- The architecture overview above.

## Testing

- API route: URL validation (accept valid http/https, reject junk), model-slug
  assembly (`:online` appended), missing-key error path, and non-JSON response
  handling (returns raw text + parseError flag).
- Light frontend check that the form posts and renders/streams a result.
```
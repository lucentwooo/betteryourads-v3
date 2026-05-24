# Brand DNA Extractor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hosted Next.js app where a user enters a SaaS website URL and gets back the Brand DNA JSON profile, produced by a web-enabled OpenRouter model.

**Architecture:** Next.js (App Router) on Vercel. A client page posts a URL to `/api/extract`. The server route holds the OpenRouter key, sends the Brand DNA prompt + URL to a `:online` (web-enabled) model, and streams the text back. The client strips code fences, parses JSON, and offers Copy / Download.

**Tech Stack:** Next.js (App Router, TypeScript), React, Vitest for unit tests, OpenRouter chat completions API, Vercel for deploy.

---

## File Structure

```
package.json                 # Next.js + scripts + vitest
vitest.config.ts             # test config
tsconfig.json                # TS config (from create-next-app)
next.config.ts               # Next config (from create-next-app)
.env.example                 # documents OPENROUTER_API_KEY, OPENROUTER_MODEL
.gitignore                   # ignore .env*.local, node_modules, .next
/lib
  brandDnaPrompt.ts          # exported prompt string (source of truth in code)
  extract.ts                 # pure helpers: isValidHttpUrl, resolveModel, buildModelSlug, extractJson
  extract.test.ts            # unit tests for extract.ts
/app
  layout.tsx                 # root layout (from create-next-app)
  page.tsx                   # UI: URL field + Extract button + result viewer
  /api/extract/route.ts      # server route: OpenRouter call + streaming
CLAUDE.md                    # project documentation
Extract Brand DNA Prompt - Copy.txt   # original prompt (already present, kept as reference)
```

Responsibilities:
- `lib/extract.ts` — all pure, testable logic (validation, model slug, JSON extraction). No Next/React/network imports.
- `app/api/extract/route.ts` — thin wiring: validate, call OpenRouter, transform SSE to a plain-text stream.
- `app/page.tsx` — UI and client-side JSON parsing via `extractJson`.

---

## Task 1: Scaffold the Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `.gitignore`, `vitest.config.ts`

- [ ] **Step 1: Scaffold with create-next-app**

The repo already contains `Extract Brand DNA Prompt - Copy.txt`, `docs/`, and `.git`. Scaffold into the current directory (note the trailing `.`):

Run:
```bash
npx create-next-app@latest . --typescript --app --no-tailwind --no-src-dir --no-eslint --import-alias "@/*" --use-npm
```
If prompted that the directory is not empty, choose to continue (it keeps existing files).

Expected: creates `package.json`, `app/`, `tsconfig.json`, `next.config.ts`, `.gitignore`, etc.

- [ ] **Step 2: Add Vitest**

Run:
```bash
npm install -D vitest
```

- [ ] **Step 3: Add the test script**

Modify `package.json` — add a `test` script under `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 4: Create `vitest.config.ts`**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Verify the project builds and tests run**

Run:
```bash
npm run build
npx vitest run
```
Expected: `npm run build` succeeds. `vitest run` reports "No test files found" (no tests yet) and exits 0.

- [ ] **Step 6: Confirm `.gitignore` covers env + build**

Ensure `.gitignore` contains these lines (create-next-app adds most; add any missing):
```
/node_modules
/.next
.env*.local
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest"
```

---

## Task 2: Add the Brand DNA prompt as a module

**Files:**
- Create: `lib/brandDnaPrompt.ts`
- Reference: `Extract Brand DNA Prompt - Copy.txt`

- [ ] **Step 1: Create `lib/brandDnaPrompt.ts`**

Copy the prompt body **verbatim** from `Extract Brand DNA Prompt - Copy.txt` — specifically the text *inside* the ```` ```text ```` fence (it starts with `You are a senior SaaS ad strategist...` and ends with the closing ` ``` ` rules block, i.e. the line `- Focus on what will help generate a specific, premium, on-brand static SaaS ad.`). Do **not** include the markdown fences or the `# Write-An-Amazing-Prompt` heading.

The prompt body contains no backticks and no `${`, so a template literal is safe. Create:
```ts
export const BRAND_DNA_PROMPT = `You are a senior SaaS ad strategist, brand analyst, conversion copywriter, and visual creative director.

<PASTE THE REST OF THE PROMPT BODY HERE, VERBATIM, THROUGH THE FINAL RULES LINE>
`;
```

> Implementation note: open the `.txt`, copy lines 6–522 (the content between the fences), and paste them between the backticks. Verify the pasted text contains no stray backtick characters before saving.

- [ ] **Step 2: Verify it imports and is non-trivial**

Run:
```bash
node --input-type=module -e "import('./lib/brandDnaPrompt.ts').catch(()=>{}); " 2>/dev/null; npx tsc --noEmit
```
Expected: `tsc --noEmit` passes (no type errors). (The prompt is a plain string export.)

- [ ] **Step 3: Commit**

```bash
git add lib/brandDnaPrompt.ts
git commit -m "feat: add Brand DNA prompt module"
```

---

## Task 3: Pure helpers in `lib/extract.ts` (TDD)

**Files:**
- Create: `lib/extract.ts`
- Test: `lib/extract.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/extract.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  isValidHttpUrl,
  resolveModel,
  buildModelSlug,
  extractJson,
  DEFAULT_MODEL,
} from "./extract";

describe("isValidHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isValidHttpUrl("https://example.com")).toBe(true);
    expect(isValidHttpUrl("http://example.com/page")).toBe(true);
  });
  it("rejects junk, empty, and non-http schemes", () => {
    expect(isValidHttpUrl("")).toBe(false);
    expect(isValidHttpUrl("not a url")).toBe(false);
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("resolveModel", () => {
  it("returns the env value when set and non-empty", () => {
    expect(resolveModel("openai/gpt-4o")).toBe("openai/gpt-4o");
  });
  it("falls back to DEFAULT_MODEL when undefined or blank", () => {
    expect(resolveModel(undefined)).toBe(DEFAULT_MODEL);
    expect(resolveModel("   ")).toBe(DEFAULT_MODEL);
  });
});

describe("buildModelSlug", () => {
  it("appends :online when not present", () => {
    expect(buildModelSlug("anthropic/claude-3.7-sonnet")).toBe(
      "anthropic/claude-3.7-sonnet:online"
    );
  });
  it("does not double-append :online", () => {
    expect(buildModelSlug("anthropic/claude-3.7-sonnet:online")).toBe(
      "anthropic/claude-3.7-sonnet:online"
    );
  });
});

describe("extractJson", () => {
  it("parses plain JSON", () => {
    const r = extractJson('{"a":1}');
    expect(r.parseError).toBe(false);
    expect(r.json).toEqual({ a: 1 });
  });
  it("strips ```json fences before parsing", () => {
    const r = extractJson('```json\n{"a":1}\n```');
    expect(r.parseError).toBe(false);
    expect(r.json).toEqual({ a: 1 });
  });
  it("returns parseError with raw text when not JSON", () => {
    const r = extractJson("sorry, I could not browse the site");
    expect(r.parseError).toBe(true);
    expect(r.json).toBeNull();
    expect(r.raw).toContain("could not browse");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/extract.test.ts`
Expected: FAIL — `Cannot find module './extract'` / exports undefined.

- [ ] **Step 3: Implement `lib/extract.ts`**

Create `lib/extract.ts`:
```ts
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
```

> Note: `DEFAULT_MODEL` is a sensible default — verify the slug exists on OpenRouter (https://openrouter.ai/models) at deploy time and update if needed. It is overridable via `OPENROUTER_MODEL`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/extract.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add lib/extract.ts lib/extract.test.ts
git commit -m "feat: add and test pure extraction helpers"
```

---

## Task 4: API route with OpenRouter streaming

**Files:**
- Create: `app/api/extract/route.ts`

- [ ] **Step 1: Implement the route**

Create `app/api/extract/route.ts`:
```ts
import { BRAND_DNA_PROMPT } from "@/lib/brandDnaPrompt";
import { isValidHttpUrl, resolveModel, buildModelSlug } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 300;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Server is missing OPENROUTER_API_KEY." },
      { status: 500 }
    );
  }

  let url = "";
  try {
    const body = await req.json();
    url = typeof body?.url === "string" ? body.url : "";
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isValidHttpUrl(url)) {
    return Response.json(
      { error: "Please provide a valid http(s) URL." },
      { status: 400 }
    );
  }

  const model = buildModelSlug(resolveModel(process.env.OPENROUTER_MODEL));

  const upstream = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: BRAND_DNA_PROMPT },
        { role: "user", content: `Website URL: ${url}` },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return Response.json(
      { error: `OpenRouter request failed (${upstream.status}). ${detail}`.trim() },
      { status: 502 }
    );
  }

  // Transform OpenRouter SSE into a plain-text stream of content deltas.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          controller.close();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const delta: string | undefined = parsed?.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        } catch {
          // ignore keep-alive / non-JSON lines
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 2: Verify it type-checks and builds**

Run:
```bash
npx tsc --noEmit
npm run build
```
Expected: both succeed.

- [ ] **Step 3: Manual smoke test (requires a real key)**

Create a local `.env.local` with `OPENROUTER_API_KEY=sk-...` (your key). Then:
```bash
npm run dev
```
In another terminal:
```bash
curl -N -X POST http://localhost:3000/api/extract -H "Content-Type: application/json" -d "{\"url\":\"https://stripe.com\"}"
```
Expected: a stream of text that, taken together, is the Brand DNA JSON. Also verify error paths:
```bash
curl -X POST http://localhost:3000/api/extract -H "Content-Type: application/json" -d "{\"url\":\"nope\"}"
```
Expected: `{"error":"Please provide a valid http(s) URL."}` with 400.

- [ ] **Step 4: Commit**

```bash
git add app/api/extract/route.ts
git commit -m "feat: add /api/extract streaming OpenRouter route"
```

---

## Task 5: Frontend page

**Files:**
- Modify: `app/page.tsx` (replace create-next-app default)

- [ ] **Step 1: Implement the UI**

Replace the contents of `app/page.tsx` with:
```tsx
"use client";

import { useState } from "react";
import { extractJson, isValidHttpUrl } from "@/lib/extract";

export default function Home() {
  const [url, setUrl] = useState("");
  const [streamText, setStreamText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ pretty: string; parseError: boolean } | null>(null);

  async function handleExtract() {
    setError("");
    setResult(null);
    setStreamText("");
    if (!isValidHttpUrl(url)) {
      setError("Please enter a valid http(s) URL.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed." }));
        throw new Error(data.error ?? `Request failed (${res.status}).`);
      }
      if (!res.body) throw new Error("No response stream.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreamText(acc);
      }
      const parsed = extractJson(acc);
      setResult({
        pretty: parsed.parseError ? parsed.raw : JSON.stringify(parsed.json, null, 2),
        parseError: parsed.parseError,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (result) navigator.clipboard.writeText(result.pretty);
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result.pretty], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "brand-dna.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Brand DNA Extractor</h1>
      <p>Enter a SaaS website URL to generate a structured creative-intelligence profile.</p>
      <div style={{ display: "flex", gap: 8, margin: "1rem 0" }}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          style={{ flex: 1, padding: "0.6rem", fontSize: 16 }}
          disabled={loading}
        />
        <button onClick={handleExtract} disabled={loading} style={{ padding: "0.6rem 1.2rem", fontSize: 16 }}>
          {loading ? "Extracting…" : "Extract"}
        </button>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {loading && (
        <div>
          <p>Analyzing the site… this can take a minute.</p>
          <pre style={preStyle}>{streamText.slice(-2000)}</pre>
        </div>
      )}

      {result && !loading && (
        <div>
          {result.parseError && (
            <p style={{ color: "darkorange" }}>
              The model did not return valid JSON. Showing raw output below.
            </p>
          )}
          <div style={{ display: "flex", gap: 8, margin: "0.5rem 0" }}>
            <button onClick={copy}>Copy</button>
            <button onClick={download}>Download .json</button>
          </div>
          <pre style={preStyle}>{result.pretty}</pre>
        </div>
      )}
    </main>
  );
}

const preStyle: React.CSSProperties = {
  background: "#0b1020",
  color: "#d6e2ff",
  padding: "1rem",
  borderRadius: 8,
  overflow: "auto",
  maxHeight: 480,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
```

- [ ] **Step 2: Verify build and type-check**

Run:
```bash
npx tsc --noEmit
npm run build
```
Expected: both succeed.

- [ ] **Step 3: Manual check**

With `npm run dev` running and a valid `.env.local`, open http://localhost:3000, enter a real SaaS URL, click Extract. Expected: streaming progress, then a pretty-printed JSON panel with working Copy and Download buttons. Enter `nope` → inline validation error, no request.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add Brand DNA Extractor UI"
```

---

## Task 6: Docs and env example

**Files:**
- Create: `.env.example`, `CLAUDE.md`

- [ ] **Step 1: Create `.env.example`**

Create `.env.example`:
```
# Required: your OpenRouter API key (server-side only, never exposed to the browser)
OPENROUTER_API_KEY=

# Optional: model slug WITHOUT the :online suffix (the app appends it).
# Defaults to anthropic/claude-3.7-sonnet if unset. See https://openrouter.ai/models
OPENROUTER_MODEL=
```

- [ ] **Step 2: Create `CLAUDE.md`**

Create `CLAUDE.md`:
```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs: add CLAUDE.md and .env.example"
```

---

## Self-Review Notes

- **Spec coverage:** URL→JSON flow (Tasks 4,5), web-enabled `:online` model (Task 4), server-side key (Task 4), env-var model with default (Tasks 3,4,6), streaming + `maxDuration=300` (Task 4), Copy/Download (Task 5), non-JSON fallback (Tasks 3,5), validation/error handling (Tasks 3,4,5), CLAUDE.md + prompt source-of-truth (Tasks 2,6), no-auth tradeoff documented (Task 6). All spec sections covered.
- **Type consistency:** `isValidHttpUrl`, `resolveModel`, `buildModelSlug`, `extractJson`/`ExtractJsonResult`, `DEFAULT_MODEL` are defined in Task 3 and used identically in Tasks 4 and 5.
- **Placeholders:** The only intentional "paste here" is the verbatim prompt body in Task 2 (it lives in the repo's `.txt`; reproducing ~500 lines inline would be error-prone). Explicit copy instructions and line range are given.
```
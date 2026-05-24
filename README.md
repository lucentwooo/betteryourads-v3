# Brand DNA Extractor

A Next.js app that takes a SaaS website URL and returns a structured "Brand DNA"
JSON profile (brand identity, visual system, offer DNA, messaging, proof,
competitor intel, and 5 static ad concepts) for generating Meta ads. It sends a
large extraction prompt plus the URL to a web-enabled OpenRouter model and streams
the JSON result back.

## Quick start

```bash
npm install
cp .env.example .env.local   # then add your OPENROUTER_API_KEY
npm run dev                  # http://localhost:3000
```

See **[CLAUDE.md](./CLAUDE.md)** for full documentation: how it works, environment
variables, the prompt source of truth, deployment to Vercel, and known limitations.

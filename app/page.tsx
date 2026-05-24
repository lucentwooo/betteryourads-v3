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
      acc += decoder.decode();
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
    if (!result) return;
    navigator.clipboard?.writeText(result.pretty).catch(() => setError("Copy failed."));
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) handleExtract();
          }}
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

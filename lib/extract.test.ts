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

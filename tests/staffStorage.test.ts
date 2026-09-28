import { describe, it, expect } from "vitest";
import { extractStoragePath } from "../lib/staffStorage";

describe("extractStoragePath", () => {
  it("extracts the path from a legacy full public URL", () => {
    expect(extractStoragePath("evidence", "https://proj.supabase.co/storage/v1/object/public/evidence/call-1/photo.jpg"))
      .toBe("call-1/photo.jpg");
  });

  it("decodes URL-encoded characters and strips a query string", () => {
    expect(extractStoragePath("documents", "https://x.supabase.co/storage/v1/object/public/documents/people/abc/photo%20id.jpg?t=123"))
      .toBe("people/abc/photo id.jpg");
  });

  it("passes through an already-bare path unchanged", () => {
    expect(extractStoragePath("evidence", "call-1/1234-photo.jpg")).toBe("call-1/1234-photo.jpg");
  });

  it("only matches the given bucket's own segment, not another bucket's", () => {
    expect(extractStoragePath("evidence", "https://x.supabase.co/storage/v1/object/public/documents/foo.pdf")).toBeNull();
  });

  it("returns null for null/undefined/empty input", () => {
    expect(extractStoragePath("evidence", null)).toBeNull();
    expect(extractStoragePath("evidence", undefined)).toBeNull();
    expect(extractStoragePath("evidence", "")).toBeNull();
  });

  it("returns null for an unrecognized URL rather than treating it as a path", () => {
    expect(extractStoragePath("evidence", "https://evil.example.com/not/a/storage/path")).toBeNull();
  });
});

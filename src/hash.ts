// Lightweight SHA-256 wrapper. Uses node:crypto when available, otherwise falls back
// to Web Crypto (works in edge runtimes and modern browsers). Async-only because
// Web Crypto's subtle.digest is async; we use it off the host call's hot path.

export async function sha256(input: string): Promise<string> {
  if (typeof process !== "undefined" && process.versions?.node) {
    const { createHash } = await import("node:crypto");
    return createHash("sha256").update(input).digest("hex");
  }
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

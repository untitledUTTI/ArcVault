/**
 * Cross-environment SHA-256 hex digest (works in Browser WebCrypto and Node/Vitest).
 */
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;

  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    // Copy into an ArrayBuffer-backed Uint8Array so TypeScript strict lib matches BufferSource
    const buf = new Uint8Array(bytes.byteLength);
    buf.set(bytes);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  throw new Error('WebCrypto subtle SHA-256 is unavailable in this environment');
}

export function countCharsAndWords(text: string): number {
  const cleaned = text.replace(/\s+/g, '');
  return cleaned.length;
}

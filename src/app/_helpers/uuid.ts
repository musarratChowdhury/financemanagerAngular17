/**
 * Generates a RFC 4122 v4 UUID.
 *
 * `crypto.randomUUID()` is only exposed in a secure context (HTTPS or localhost).
 * Any other origin - notably a phone hitting the dev server over plain http on a
 * LAN IP - leaves it undefined, so calling it directly throws. `crypto.getRandomValues`
 * has no such restriction, so use it as the first fallback.
 */
export function uuid(): string {
  const cryptoRef = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof cryptoRef?.getRandomValues === 'function') {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Per RFC 4122: set the version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

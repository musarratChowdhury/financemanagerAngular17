import { uuid } from './uuid';

describe('uuid()', () => {
  const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  function stubCrypto(value: unknown): void {
    Object.defineProperty(globalThis, 'crypto', {
      value,
      configurable: true,
      writable: true,
    });
  }

  afterEach(() => {
    // `crypto` normally lives on Window.prototype, so deleting our own property restores it.
    if (originalCrypto) {
      Object.defineProperty(globalThis, 'crypto', originalCrypto);
    } else {
      delete (globalThis as { crypto?: unknown }).crypto;
    }
  });

  it('returns an RFC 4122 version 4 UUID', () => {
    expect(uuid()).toMatch(V4);
  });

  it('returns a different value on each call', () => {
    const ids = new Set([uuid(), uuid(), uuid(), uuid(), uuid()]);

    expect(ids.size).toBe(5);
  });

  it('still returns a v4 UUID when crypto.randomUUID is unavailable (non-secure context)', () => {
    stubCrypto({
      getRandomValues: (bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = i * 7;
        }
        return bytes;
      },
    });

    expect(uuid()).toMatch(V4);
  });

  it('falls back to Math.random when crypto is unavailable entirely', () => {
    stubCrypto(undefined);

    expect(uuid()).toMatch(V4);
  });
});

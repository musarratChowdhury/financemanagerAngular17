import { readStoredProfile, readTokenProfile } from './jwt';

/** Build a JWT-ish string: the decoder never checks the signature. */
function token(payload: Record<string, unknown>): string {
  const encode = (value: unknown): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const binary = String.fromCharCode(...bytes);

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('jwt helpers', () => {
  it('reads the claims the API puts in the access token', () => {
    const profile = readTokenProfile(
      token({
        unique_name: 'musarrat',
        email: 'm@example.com',
        nameid: '8f1c-user-id',
        iat: 1_700_000_000,
        exp: 1_700_010_800,
      })
    );

    expect(profile).not.toBeNull();
    expect(profile!.userName).toBe('musarrat');
    expect(profile!.email).toBe('m@example.com');
    expect(profile!.userId).toBe('8f1c-user-id');
    expect(profile!.issuedAt).toBe(1_700_000_000_000);
    expect(profile!.expiresAt).toBe(1_700_010_800_000);
  });

  it('falls back to `sub` when the email claim is absent', () => {
    const profile = readTokenProfile(token({ sub: 'someone@example.com' }));

    expect(profile!.email).toBe('someone@example.com');
  });

  it('decodes a non-ASCII name as UTF-8, not Latin-1', () => {
    const profile = readTokenProfile(token({ unique_name: 'Müsarrat' }));

    expect(profile!.userName).toBe('Müsarrat');
  });

  it('returns null instead of throwing on a token that is not a JWT', () => {
    expect(readTokenProfile('not-a-token')).toBeNull();
    expect(readTokenProfile('a.!!!.c')).toBeNull();
    expect(readTokenProfile('')).toBeNull();
  });

  it('accepts the string `StorageService` actually stores', () => {
    // saveUser() is called with the token itself, so auth-user holds a JSON
    // string and getUser() hands back the bare token.
    const profile = readStoredProfile(token({ email: 'a@b.c' }));

    expect(profile!.email).toBe('a@b.c');
  });

  it('also accepts the older { token } shape and rejects nothing useful', () => {
    expect(readStoredProfile({ token: token({ email: 'old@b.c' }) })!.email).toBe(
      'old@b.c'
    );
    expect(readStoredProfile({})).toBeNull();
    expect(readStoredProfile(null)).toBeNull();
  });
});

/**
 * The identity carried inside the access token this app stores.
 *
 * There is no `/me` endpoint on the API, so the profile sheet reads the claims
 * the server already signed. Nothing here is a security check: the API verifies
 * the token on every request, and this only decides what to print.
 */
export interface TokenProfile {
  email: string | null;
  userName: string | null;
  userId: string | null;
  /** Epoch ms the token was issued at, if the claim is present. */
  issuedAt: number | null;
  /** Epoch ms the token expires at, if the claim is present. */
  expiresAt: number | null;
}

/** `ClaimTypes.Name` / `ClaimTypes.NameIdentifier`, as JwtSecurityTokenHandler writes them. */
const NAME_CLAIMS = [
  'unique_name',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
];
const ID_CLAIMS = [
  'nameid',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
];

/**
 * Read a profile out of whatever `StorageService` happens to hold.
 *
 * `saveUser()` is called with the token itself, so `auth-user` is a JSON *string*
 * (`"\"eyJ..."` -> `getUser()` returns `eyJ...`). Older builds stored an object
 * with a `token` field, so both shapes are accepted.
 */
export function readStoredProfile(stored: unknown): TokenProfile | null {
  const token =
    typeof stored === 'string'
      ? stored
      : typeof (stored as { token?: unknown })?.token === 'string'
        ? ((stored as { token: string }).token)
        : null;

  return token ? readTokenProfile(token) : null;
}

/** Decode a JWT's claims without verifying it. Returns null for anything odd. */
export function readTokenProfile(token: string): TokenProfile | null {
  const claims = decodePayload(token);
  if (!claims) return null;

  return {
    email: firstString(claims, ['email', 'sub']),
    userName: firstString(claims, NAME_CLAIMS),
    userId: firstString(claims, ID_CLAIMS),
    issuedAt: epochMs(claims['iat']),
    expiresAt: epochMs(claims['exp']),
  };
}

function decodePayload(token: string): Record<string, unknown> | null {
  const encoded = token.split('.')[1];
  if (!encoded) return null;

  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

    // atob gives one char per byte; decode as UTF-8 so non-ASCII names survive.
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    // Not a JWT, truncated, or not base64url - the caller shows a fallback.
    return null;
  }
}

function firstString(
  claims: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = claims[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }

  return null;
}

/** JWT `iat` / `exp` are seconds; the UI formats milliseconds. */
function epochMs(claim: unknown): number | null {
  return typeof claim === 'number' && Number.isFinite(claim)
    ? claim * 1000
    : null;
}

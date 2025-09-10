const te = new TextEncoder();
const td = new TextDecoder();

function toB64u(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromB64u(b64u: string): Uint8Array {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const b64u = { to: toB64u, from: fromB64u };

export function getRandomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export async function deriveAesGcmKey(master_b64u: string, salt_b64u: string): Promise<CryptoKey> {
  const master = fromB64u(master_b64u);
  const salt = fromB64u(salt_b64u);
  const hkdfKey = await crypto.subtle.importKey('raw', master, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new Uint8Array() },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptString(plaintext: string, key: CryptoKey) {
  const iv = getRandomBytes(12);
  const data = te.encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv_b64u: toB64u(iv), ct_b64u: toB64u(new Uint8Array(ct)) };
}

export async function decryptString(payload: { iv_b64u: string; ct_b64u: string }, key: CryptoKey) {
  const iv = fromB64u(payload.iv_b64u);
  const ct = fromB64u(payload.ct_b64u);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return td.decode(pt);
}

// Envelope helpers (v1): v1.{salt_b64u}.{iv_b64u}.{ct_b64u}.{key_id}
export function serializeEnvelopeV1(params: { salt_b64u: string; iv_b64u: string; ct_b64u: string; key_id: string }) {
  const { salt_b64u, iv_b64u, ct_b64u, key_id } = params;
  if (!salt_b64u || !iv_b64u || !ct_b64u || !key_id) throw new Error('Envelope fields missing');
  return `v1.${salt_b64u}.${iv_b64u}.${ct_b64u}.${key_id}`;
}
export function parseEnvelopeV1(envelope: string) {
  const parts = envelope.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') throw new Error('Invalid envelope');
  const [_, salt_b64u, iv_b64u, ct_b64u, key_id] = parts;
  return { salt_b64u, iv_b64u, ct_b64u, key_id };
}


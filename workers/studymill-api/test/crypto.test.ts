import { describe, it, expect } from 'vitest';
import nodeCrypto from 'node:crypto';

// Polyfills for Node/vitest environment
if (!(globalThis as any).crypto) (globalThis as any).crypto = nodeCrypto.webcrypto as any;
if (!(globalThis as any).btoa) (globalThis as any).btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
if (!(globalThis as any).atob) (globalThis as any).atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');

import { b64u, getRandomBytes, deriveAesGcmKey, encryptString, decryptString, serializeEnvelopeV1, parseEnvelopeV1 } from '../src/utils/crypto';

describe('crypto', () => {
  it('b64url roundtrip', () => {
    const bytes = getRandomBytes(32);
    const s = b64u.to(bytes);
    const back = b64u.from(s);
    expect(back.length).toBe(bytes.length);
    for (let i = 0; i < bytes.length; i++) expect(back[i]).toBe(bytes[i]);
  });

  it('encrypt/decrypt with v1 envelope', async () => {
    const master = b64u.to(getRandomBytes(32));
    const salt = b64u.to(getRandomBytes(16));
    const key = await deriveAesGcmKey(master, salt);
    const sample = 'secret こんにちは 🔐';
    const enc = await encryptString(sample, key);
    const env = serializeEnvelopeV1({ salt_b64u: salt, iv_b64u: enc.iv_b64u, ct_b64u: enc.ct_b64u, key_id: 'k1' });
    const parsed = parseEnvelopeV1(env);
    const key2 = await deriveAesGcmKey(master, parsed.salt_b64u);
    const dec = await decryptString({ iv_b64u: parsed.iv_b64u, ct_b64u: parsed.ct_b64u }, key2);
    expect(dec).toBe(sample);
  });
});


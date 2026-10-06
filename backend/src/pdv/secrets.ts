import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';

function key(): Buffer {
  const explicit = process.env.PDV_SECRETS_KEY?.trim();
  if (explicit) {
    const buf = Buffer.from(explicit, /^[0-9a-f]{64}$/i.test(explicit) ? 'hex' : 'utf8');
    return buf.length === 32 ? buf : createHash('sha256').update(buf).digest();
  }
  const seed = process.env.JWT_SECRET || 'troque-isto';
  return scryptSync(seed, 'pdv-soaco-secrets', 32);
}

export function cifrar(plain: Buffer | string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.isBuffer(plain) ? plain : Buffer.from(plain, 'utf8');
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decifrar(payload: string): Buffer {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

export function decifrarTexto(payload: string): string {
  return decifrar(payload).toString('utf8');
}

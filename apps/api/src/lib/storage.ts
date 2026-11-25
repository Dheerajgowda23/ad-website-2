import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import type { Env } from '../config/env.js';
import { badRequest, notFound } from './http.js';

/**
 * Document storage for a v1 that runs inside an air-gapped network.
 *
 * Files live on a mounted volume (FILE_STORAGE_DIR) instead of an object store, so
 * the portal has no extra service to install on the intranet PC. The contract
 * requires versioned, hash-referenced files that are never overwritten: the key
 * contains the content hash, so two uploads never share a path, and documents are
 * soft-deleted in the database rather than removed from disk.
 *
 * Every file is encrypted at rest (AES-256-GCM) because an Aadhaar scan must never
 * sit readable on the disk. The key comes from FILE_ENCRYPTION_KEY, falling back to
 * SESSION_SECRET for a dev install; set it explicitly in production.
 *
 * Virus scanning (ClamAV) is still M7 work: uploads are stored with scan_status
 * PENDING, are never executed, and are only served as attachments.
 */
export const storageRoot = (env: Env): string => resolve(env.FILE_STORAGE_DIR);

const MAGIC = Buffer.from('ADAENC1\0');
const IV_BYTES = 12;
const TAG_BYTES = 16;

const encryptionKey = (env: Env): Buffer =>
  scryptSync(env.FILE_ENCRYPTION_KEY ?? env.SESSION_SECRET, 'ada-file-encryption-v1', 32);

const encrypt = (buffer: Buffer, key: Buffer): Buffer => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
};

/** Files written before encryption existed have no header and stay readable. */
const decrypt = (buffer: Buffer, key: Buffer): Buffer => {
  if (buffer.length < MAGIC.length + IV_BYTES + TAG_BYTES || !buffer.subarray(0, MAGIC.length).equals(MAGIC)) {
    return buffer;
  }
  const iv = buffer.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = buffer.subarray(MAGIC.length + IV_BYTES, MAGIC.length + IV_BYTES + TAG_BYTES);
  const body = buffer.subarray(MAGIC.length + IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
};

const safeSegment = (value: string): string =>
  value.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '_').slice(0, 120) || 'file';

export interface StoredFile {
  storageKey: string;
  sha256: string;
  size: number;
}

export const storeDocumentFile = async (
  env: Env,
  input: { applicationId: string; kind: string; fileName: string; buffer: Buffer },
): Promise<StoredFile> => {
  const sha256 = createHash('sha256').update(input.buffer).digest('hex');
  const storageKey = [
    'applications',
    safeSegment(input.applicationId),
    `${safeSegment(input.kind)}-${sha256.slice(0, 16)}-${safeSegment(input.fileName)}`,
  ].join('/');

  const absolute = resolve(storageRoot(env), storageKey);
  await mkdir(dirname(absolute), { recursive: true });

  // Write then rename, so a half-written file is never visible under its final key.
  const temporary = `${absolute}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, encrypt(input.buffer, encryptionKey(env)), { mode: 0o600 });
  await rename(temporary, absolute);

  return { storageKey, sha256, size: input.buffer.length };
};

export const readStoredFile = async (env: Env, storageKey: string): Promise<Buffer> => {
  const root = storageRoot(env);
  const absolute = resolve(root, storageKey);
  const rel = relative(root, absolute);
  if (rel.startsWith('..') || rel.split(sep).includes('..')) {
    throw badRequest('INVALID_STORAGE_KEY', 'That document reference is not valid');
  }

  try {
    return decrypt(await readFile(absolute), encryptionKey(env));
  } catch {
    throw notFound('FILE_MISSING', 'The stored copy of this document is missing from disk');
  }
};

/** A filename that is safe in a Content-Disposition header. */
export const downloadName = (kind: string, fileName: string): string => {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return `${kind}-${base}`.replace(/[^\w.\- ]+/g, '_');
};

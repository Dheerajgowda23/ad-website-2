import { createHash } from 'node:crypto';
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
 * Virus scanning (ClamAV) is still M7 work: files are stored as-is and are never
 * executed or served with an inline HTML content type.
 */
export const storageRoot = (env: Env): string => resolve(env.FILE_STORAGE_DIR);

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
  await writeFile(temporary, input.buffer, { mode: 0o600 });
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
    return await readFile(absolute);
  } catch {
    throw notFound('FILE_MISSING', 'The stored copy of this document is missing from disk');
  }
};

/** A filename that is safe in a Content-Disposition header. */
export const downloadName = (kind: string, fileName: string): string => {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return `${kind}-${base}`.replace(/[^\w.\- ]+/g, '_');
};

import { createHash } from 'node:crypto';

export function hashInboundToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isWellFormedInboundToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

import crypto from 'node:crypto';

export function randomToken(bytes = 48): string { //bytes = 48 means if i do not pass number of bytes use 42 if i pass use what i pass
  return crypto.randomBytes(bytes).toString('base64url');//base64 does not include - +... makes it url safe
}
export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
export function randomSixDigitCode(): string {
  return String(crypto.randomInt(100_000, 1_000_000));//from 100000 to 999999
}
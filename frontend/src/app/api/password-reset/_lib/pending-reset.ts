import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "../../signup/_lib/server-env";

export const pendingPasswordResetCookieName = "pentecost_pending_password_reset";

export interface PendingPasswordReset {
  email: string;
  userId: string;
  codeHash: string;
  expiresAt: string;
}

function base64UrlEncode(value: Buffer) {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="), "base64");
}

function tokenSecret() {
  const secret =
    getServerEnv("PASSWORD_RESET_TOKEN_SECRET") ||
    getServerEnv("SIGNUP_TOKEN_SECRET") ||
    getServerEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!secret) {
    throw new Error("Password reset token secret is not configured.");
  }

  return secret;
}

function encryptionKey() {
  return createHash("sha256").update(tokenSecret()).digest();
}

export function hashResetCode(email: string, code: string) {
  return createHash("sha256")
    .update(`${email.toLowerCase()}:${code}:${tokenSecret()}`)
    .digest("hex");
}

export function codeHashesMatch(expectedHash: string, actualHash: string) {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function encryptPendingPasswordReset(payload: PendingPasswordReset) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    base64UrlEncode(iv),
    base64UrlEncode(authTag),
    base64UrlEncode(ciphertext),
  ].join(".");
}

export function decryptPendingPasswordReset(token: string): PendingPasswordReset {
  const [ivValue, authTagValue, ciphertextValue] = token.split(".");
  if (!ivValue || !authTagValue || !ciphertextValue) {
    throw new Error("Password reset token is invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), base64UrlDecode(ivValue));
  decipher.setAuthTag(base64UrlDecode(authTagValue));

  const plaintext = Buffer.concat([
    decipher.update(base64UrlDecode(ciphertextValue)),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plaintext) as PendingPasswordReset;
}

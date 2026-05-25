import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { env } from "@/src/lib/env";

const algorithm = "aes-256-gcm";
const version = "v1";
let cachedEncryptionKey: Buffer | undefined;

function decodeEncryptionKey(value: string) {
  const trimmed = value.trim();
  const base64Key = Buffer.from(trimmed, "base64");

  if (base64Key.length === 32) {
    return base64Key;
  }

  const utf8Key = Buffer.from(trimmed, "utf8");

  if (utf8Key.length === 32) {
    return utf8Key;
  }

  return null;
}

function readKeyFile() {
  if (!existsSync(env.APP_ENCRYPTION_KEY_FILE)) {
    return null;
  }

  return readFileSync(env.APP_ENCRYPTION_KEY_FILE, "utf8").trim();
}

function generateKeyFile() {
  mkdirSync(dirname(env.APP_ENCRYPTION_KEY_FILE), { recursive: true, mode: 0o700 });

  const generatedKey = randomBytes(32).toString("base64");

  try {
    writeFileSync(env.APP_ENCRYPTION_KEY_FILE, `${generatedKey}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    chmodSync(env.APP_ENCRYPTION_KEY_FILE, 0o600);
    return generatedKey;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      const existingKey = readKeyFile();

      if (existingKey) {
        return existingKey;
      }
    }

    throw error;
  }
}

function getEncryptionKey() {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }

  if (env.APP_ENCRYPTION_KEY) {
    const envKey = decodeEncryptionKey(env.APP_ENCRYPTION_KEY);

    if (!envKey) {
      throw new Error("APP_ENCRYPTION_KEY must be exactly 32 bytes or base64-encoded 32 bytes.");
    }

    cachedEncryptionKey = envKey;
    return cachedEncryptionKey;
  }

  const fileKey = decodeEncryptionKey(readKeyFile() ?? generateKeyFile());

  if (!fileKey) {
    throw new Error("APP_ENCRYPTION_KEY_FILE contains an invalid key.");
  }

  cachedEncryptionKey = fileKey;
  return cachedEncryptionKey;
}

export function getEncryptionKeyStatus() {
  if (env.APP_ENCRYPTION_KEY) {
    return {
      isSet: Boolean(decodeEncryptionKey(env.APP_ENCRYPTION_KEY)),
      length: env.APP_ENCRYPTION_KEY.length,
      source: "environment" as const,
    };
  }

  try {
    const value = readKeyFile() ?? generateKeyFile();

    return {
      isSet: Boolean(decodeEncryptionKey(value)),
      length: value.length,
      source: "file" as const,
    };
  } catch {
    return {
      isSet: false,
      length: 0,
      source: "missing" as const,
    };
  }
}

export function encryptSecret(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "enc",
    version,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(value: string) {
  const [prefix, encryptedVersion, iv, tag, encrypted] = value.split(":");

  if (prefix !== "enc" || encryptedVersion !== version || !iv || !tag || !encrypted) {
    throw new Error("Encrypted setting has an unsupported format.");
  }

  const decipher = createDecipheriv(algorithm, getEncryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

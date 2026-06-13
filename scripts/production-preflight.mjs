import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const checks = [];

function add(level, label, message) {
  checks.push({ level, label, message });
}

function ok(label, message) {
  add("ok", label, message);
}

function warn(label, message) {
  add("warning", label, message);
}

function error(label, message) {
  add("error", label, message);
}

function readText(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function parseEnv(path) {
  const values = new Map();
  const text = readText(path);

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
}

function envValue(values, key, fallback = "") {
  return values.get(key) ?? fallback;
}

function isPlaceholder(value) {
  const normalized = value.toLowerCase();
  return (
    !value ||
    normalized.includes("change-this") ||
    normalized.includes("replace-with") ||
    normalized.includes("<strong") ||
    normalized.includes("<one-time")
  );
}

function commandAvailable(command, args = ["--version"]) {
  try {
    execFileSync(command, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function commandOutput(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

function serviceBlock(composeText, serviceName) {
  const lines = composeText.split(/\r?\n/);
  const start = lines.findIndex((line) => line.match(new RegExp(`^\\s{2}${serviceName}:\\s*$`)));
  if (start === -1) {
    return "";
  }

  const block = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (index > start && line.match(/^\s{2}[a-zA-Z0-9_-]+:\s*$/)) {
      break;
    }
    block.push(line);
  }

  return block.join("\n");
}

const envPath = process.env.PREFLIGHT_ENV_FILE ?? ".env";
const env = parseEnv(envPath);
const composeText = readText("docker-compose.yml");

if (existsSync(envPath)) {
  ok("Environment", `${envPath} exists.`);
} else {
  error(
    "Environment",
    `${envPath} is missing. Create it from .env.example before production start.`,
  );
}

for (const key of ["POSTGRES_APP_PASSWORD", "SESSION_SECRET", "SETUP_TOKEN"]) {
  const value = envValue(env, key);
  if (isPlaceholder(value)) {
    error("Required secret", `${key} is missing or still uses a placeholder.`);
  } else {
    ok("Required secret", `${key} is set.`);
  }
}

const appEncryptionKey = envValue(env, "APP_ENCRYPTION_KEY");
const appEncryptionKeyFile = envValue(
  env,
  "APP_ENCRYPTION_KEY_FILE",
  "/app/secrets/app_encryption_key",
);
if (appEncryptionKey) {
  if (appEncryptionKey.length < 32) {
    error("Encryption key", "APP_ENCRYPTION_KEY is set but shorter than 32 characters.");
  } else {
    ok("Encryption key", "APP_ENCRYPTION_KEY is set.");
  }
} else if (appEncryptionKeyFile) {
  warn(
    "Encryption key",
    `APP_ENCRYPTION_KEY is empty; the app will rely on persistent key file ${appEncryptionKeyFile}. Protect the secrets volume.`,
  );
} else {
  error(
    "Encryption key",
    "APP_ENCRYPTION_KEY is empty and APP_ENCRYPTION_KEY_FILE is not configured.",
  );
}

const publicAllowedHosts = envValue(
  env,
  "PUBLIC_ALLOWED_HOSTS",
  "heidekönig.gorms.de,xn--heideknig-57a.gorms.de",
);
if (publicAllowedHosts.includes("xn--heideknig-57a.gorms.de")) {
  ok("Public hosts", "Punycode public host is allowed.");
} else {
  error("Public hosts", "PUBLIC_ALLOWED_HOSTS must include xn--heideknig-57a.gorms.de.");
}

if (publicAllowedHosts.includes("heidekönig.gorms.de")) {
  ok("Public hosts", "Unicode public host is allowed.");
} else {
  warn("Public hosts", "Unicode host heidekönig.gorms.de is not listed.");
}

const adminAllowedHosts = envValue(env, "ADMIN_ALLOWED_HOSTS", "login.gorms.de");
if (
  adminAllowedHosts
    .split(",")
    .map((host) => host.trim())
    .includes("login.gorms.de")
) {
  ok("Admin hosts", "login.gorms.de is allowed.");
} else {
  error("Admin hosts", "ADMIN_ALLOWED_HOSTS must include login.gorms.de.");
}

const nextPublicSiteUrl = envValue(env, "NEXT_PUBLIC_SITE_URL");
if (nextPublicSiteUrl.startsWith("https://")) {
  ok("Public URL", "NEXT_PUBLIC_SITE_URL uses HTTPS.");
} else {
  error("Public URL", "NEXT_PUBLIC_SITE_URL should use HTTPS.");
}

const adminAppUrl = envValue(env, "ADMIN_APP_URL");
if (adminAppUrl === "https://login.gorms.de") {
  ok("Admin URL", "ADMIN_APP_URL points to login.gorms.de.");
} else {
  warn("Admin URL", "ADMIN_APP_URL should normally be https://login.gorms.de.");
}

if (envValue(env, "ADMIN_COOKIE_DOMAIN")) {
  error("Admin cookie", "ADMIN_COOKIE_DOMAIN should stay empty for host-only admin cookies.");
} else {
  ok("Admin cookie", "ADMIN_COOKIE_DOMAIN is empty, so admin cookies stay host-only.");
}

if (envValue(env, "RUN_MIGRATIONS_ON_START", "false") === "true") {
  warn("Migrations", "RUN_MIGRATIONS_ON_START=true. Use only with a verified backup.");
} else {
  ok("Migrations", "RUN_MIGRATIONS_ON_START is disabled.");
}

if (envValue(env, "PORT", "6043") === "6043") {
  ok("App port", "PORT is 6043.");
} else {
  warn("App port", "PORT differs from the documented reverse-proxy port 6043.");
}

const backupHostPath = envValue(env, "BACKUP_HOST_PATH", "/mnt/heidekoenig-backups");
const backupContainerPath = envValue(env, "BACKUP_CONTAINER_PATH", "/backups");
if (backupContainerPath === "/backups") {
  ok("Backup path", "BACKUP_CONTAINER_PATH is /backups.");
} else {
  warn("Backup path", "BACKUP_CONTAINER_PATH differs from the documented /backups path.");
}

if (existsSync(backupHostPath)) {
  ok("Backup mount", `${backupHostPath} exists.`);
  const mounts = readText("/proc/mounts");
  if (mounts.includes(` ${backupHostPath} `)) {
    ok("Backup mount", `${backupHostPath} is mounted.`);
  } else {
    warn("Backup mount", `${backupHostPath} exists but is not listed as a mount in /proc/mounts.`);
  }
} else {
  warn(
    "Backup mount",
    `${backupHostPath} does not exist yet. Create and mount it on the production host.`,
  );
}

if (commandAvailable("git", ["--version"])) {
  if (commandOutput("git", ["check-ignore", ".env"]).trim() === ".env") {
    ok("Git hygiene", ".env is ignored by Git.");
  } else {
    error("Git hygiene", ".env must be ignored by Git.");
  }

  const gitStatus = commandOutput("git", ["status", "--short"]);
  if (gitStatus.trim()) {
    warn("Git status", "Working tree has local changes. Review before production deployment.");
  } else {
    ok("Git status", "Working tree is clean.");
  }
} else {
  warn("Git", "git is not available in PATH.");
  warn("Git hygiene", "Could not verify whether .env is ignored by Git.");
}

if (commandAvailable("docker", ["--version"])) {
  ok("Docker", "Docker CLI is available.");
} else {
  warn("Docker", "Docker CLI is not available or not accessible for this user.");
}

if (commandAvailable("docker", ["compose", "version"])) {
  ok("Docker Compose", "Docker Compose plugin is available.");
} else {
  warn("Docker Compose", "Docker Compose plugin is not available or not accessible for this user.");
}

if (composeText) {
  const appBlock = serviceBlock(composeText, "app");
  const dbBlock = serviceBlock(composeText, "db");
  const backupBlock = serviceBlock(composeText, "backup");

  if (appBlock.includes('"6043:6043"') || appBlock.includes("- 6043:6043")) {
    ok("Compose app port", "App publishes port 6043.");
  } else {
    error("Compose app port", "App service should publish 6043:6043.");
  }

  if (dbBlock.includes("ports:")) {
    error("Compose database", "db service must not publish ports.");
  } else {
    ok("Compose database", "db service does not publish ports.");
  }

  if (composeText.match(/internal:\s*true/)) {
    ok("Compose network", "Internal Docker network is marked internal.");
  } else {
    error("Compose network", "Internal Docker network must be marked internal: true.");
  }

  if (backupBlock.includes('user: "3007:3009"')) {
    ok("Compose backup", "Backup service runs as UID/GID 3007:3009.");
  } else {
    warn("Compose backup", "Backup service UID/GID differs from documented NAS permissions.");
  }
} else {
  error("Compose", "docker-compose.yml is missing.");
}

const errors = checks.filter((check) => check.level === "error");
const warnings = checks.filter((check) => check.level === "warning");

for (const check of checks) {
  const marker = check.level === "ok" ? "OK" : check.level === "warning" ? "WARN" : "ERROR";
  console.log(`${marker} ${check.label}: ${check.message}`);
}

console.log("");
console.log(`Preflight result: ${errors.length} error(s), ${warnings.length} warning(s).`);

if (errors.length > 0) {
  process.exit(1);
}

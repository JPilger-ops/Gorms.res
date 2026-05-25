import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { domainToASCII, domainToUnicode } from "node:url";
import { env, requiredSecretStatus } from "@/src/lib/env";
import { checkDatabaseConnection } from "@/src/server/db";
import { getAdminAllowedHosts, getPublicAllowedHosts } from "@/src/server/host-guard";

export type SystemCheckStatus = "ok" | "warning" | "error";

export type SystemCheckItem = {
  label: string;
  status: SystemCheckStatus;
  detail: string;
};

export type SystemCheckGroup = {
  title: string;
  items: SystemCheckItem[];
};

function secretStatus(name: string, minLength: number): SystemCheckItem {
  const value = requiredSecretStatus(
    name as "APP_ENCRYPTION_KEY" | "SESSION_SECRET" | "SETUP_TOKEN",
  );

  if (!value.isSet) {
    return {
      label: name,
      status: "error",
      detail: "Nicht gesetzt.",
    };
  }

  if (value.length < minLength) {
    return {
      label: name,
      status: "warning",
      detail: "Gesetzt, aber kurz. Für Produktion starkes Secret verwenden.",
    };
  }

  return {
    label: name,
    status: "ok",
    detail: "Gesetzt.",
  };
}

async function writablePathStatus(
  label: string,
  path: string,
  required: boolean,
): Promise<SystemCheckItem> {
  const testPath = join(path, `.heidekoenig-write-test-${Date.now()}`);

  try {
    await mkdir(path, { recursive: true });
    await writeFile(testPath, "ok", { flag: "wx" });
    await rm(testPath, { force: true });

    return {
      label,
      status: "ok",
      detail: `${path} ist beschreibbar.`,
    };
  } catch {
    return {
      label,
      status: required ? "error" : "warning",
      detail: `${path} ist nicht beschreibbar oder nicht gemountet.`,
    };
  }
}

async function readablePathStatus(label: string, path: string): Promise<SystemCheckItem> {
  try {
    await access(path, constants.R_OK);
    return {
      label,
      status: "ok",
      detail: `${path} ist vorhanden.`,
    };
  } catch {
    return {
      label,
      status: "warning",
      detail: `${path} ist noch nicht vorhanden. Das ist vor Backup-Einrichtung akzeptabel.`,
    };
  }
}

function hostItems(): SystemCheckItem[] {
  const publicHosts = getPublicAllowedHosts();
  const adminHosts = getAdminAllowedHosts();
  const heidekoenigAscii = domainToASCII("heidekönig.gorms.de");
  const heidekoenigUnicode = domainToUnicode(heidekoenigAscii);

  return [
    {
      label: "Public Hosts",
      status:
        publicHosts.includes(heidekoenigAscii) && publicHosts.includes(heidekoenigUnicode)
          ? "ok"
          : "warning",
      detail: publicHosts.join(", "),
    },
    {
      label: "Admin Hosts",
      status: adminHosts.includes("login.gorms.de") ? "ok" : "warning",
      detail: adminHosts.join(", "),
    },
    {
      label: "Punycode",
      status: heidekoenigAscii === "xn--heideknig-57a.gorms.de" ? "ok" : "error",
      detail: `${heidekoenigUnicode} -> ${heidekoenigAscii}`,
    },
  ];
}

export async function runSetupSystemCheck(): Promise<SystemCheckGroup[]> {
  const uploadPath = env.UPLOAD_DIR;
  const backupPath = env.BACKUP_CONTAINER_PATH;
  const databaseOk = await checkDatabaseConnection();
  const [uploadWritable, backupPresent, backupWritable] = await Promise.all([
    writablePathStatus("Upload-Volume", uploadPath, true),
    readablePathStatus("Backup-Pfad", backupPath),
    writablePathStatus("Backup-Schreibtest", backupPath, false),
  ]);

  return [
    {
      title: "System",
      items: [
        {
          label: "Datenbank",
          status: databaseOk ? "ok" : "error",
          detail: databaseOk ? "Verbindung erfolgreich." : "Keine Datenbankverbindung.",
        },
        uploadWritable,
        backupPresent,
        backupWritable,
      ],
    },
    {
      title: "Secrets",
      items: [
        secretStatus("APP_ENCRYPTION_KEY", 32),
        secretStatus("SESSION_SECRET", 32),
        secretStatus("SETUP_TOKEN", 16),
      ],
    },
    {
      title: "Hosts",
      items: hostItems(),
    },
  ];
}

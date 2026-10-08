import { lstat, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const lock = 724186203;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const filename =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png(?:\.pending)?$/i;

async function safeFile(root, relative) {
  if ((await lstat(root)).isSymbolicLink()) return null;
  const parts = relative.split("/");
  if (
    parts.length !== 4 ||
    parts[0] !== "floorplans" ||
    !uuid.test(parts[1]) ||
    !uuid.test(parts[2]) ||
    !filename.test(parts[3])
  )
    return null;
  let path = root;
  for (const part of parts) {
    path = join(path, part);
    try {
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) return null;
    } catch (error) {
      if (error.code === "ENOENT") return { path, missing: true };
      throw error;
    }
  }
  return { path, missing: false };
}

async function generatedFiles(root) {
  const results = [];
  async function walk(path, depth, relative) {
    let entries;
    try {
      entries = await readdir(path, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (depth < 2 && entry.isDirectory() && uuid.test(entry.name))
        await walk(join(path, entry.name), depth + 1, [...relative, entry.name]);
      if (depth === 2 && entry.isFile() && filename.test(entry.name))
        results.push(["floorplans", ...relative, entry.name].join("/"));
    }
  }
  const dir = join(root, "floorplans");
  try {
    if ((await lstat(dir)).isSymbolicLink()) return [];
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await walk(dir, 0, []);
  return results;
}

export async function cleanupFloorplans(pool, { uploadDir, now = new Date() }) {
  const client = await pool.connect();
  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const result = { retiredAssets: 0, orphanFiles: 0, protectedAssets: 0 };
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [lock]);
    const assets = (
      await client.query(
        "select a.*, v.venue_id from floorplan_assets a join venue_areas v on v.id=a.area_id",
      )
    ).rows;
    for (const asset of assets) {
      const reference = await client.query(
        "select 1 from area_plan_layouts where floorplan_asset_id=$1",
        [asset.id],
      );
      if (reference.rowCount) {
        result.protectedAssets++;
        continue;
      }
      if (
        !asset.retired_at ||
        new Date(asset.retired_at) > cutoff ||
        asset.file_path !== `floorplans/${asset.venue_id}/${asset.area_id}/${asset.id}.png`
      )
        continue;
      const safe = await safeFile(uploadDir, asset.file_path);
      if (!safe) continue;
      if (!safe.missing && !(await lstat(safe.path)).isFile()) continue;
      // The exclusive lock is also used by plan writes; any remaining FK reference wins.
      if (
        (
          await client.query("select 1 from area_plan_layouts where floorplan_asset_id=$1", [
            asset.id,
          ])
        ).rowCount
      )
        continue;
      if (!safe.missing) await unlink(safe.path);
      await client.query(
        "delete from floorplan_assets where id=$1 and not exists (select 1 from area_plan_layouts where floorplan_asset_id=$1)",
        [asset.id],
      );
      result.retiredAssets++;
    }
    for (const relative of await generatedFiles(uploadDir)) {
      const safe = await safeFile(uploadDir, relative);
      if (!safe || safe.missing) continue;
      const stat = await lstat(safe.path);
      if (!stat.isFile() || stat.mtime > cutoff) continue;
      const original = relative.replace(/\.pending$/, "");
      const registered = await client.query(
        "select 1 from floorplan_assets where file_path=$1 or id=$2",
        [
          original,
          original
            .split("/")
            .at(-1)
            .replace(/\.png$/, ""),
        ],
      );
      if (registered.rowCount) continue;
      // Unknown files are eligible only after a successful complete database lookup.
      await unlink(safe.path);
      result.orphanFiles++;
    }
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

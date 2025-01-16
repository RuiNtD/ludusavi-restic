import $, { type Path } from "@david/dax";
import * as v from "@valibot/valibot";
import Env from "./env.ts";
import { ludusavi, restic } from "./exes.ts";
import { assert } from "@std/assert";
import pMemoize from "p-memoize";

const OperationStatus = v.object({
  processedBytes: v.number(),
  processedGames: v.number(),
  totalBytes: v.number(),
  totalGames: v.number(),
});
const OperationStepDecision = v.picklist(["Processed", "Cancelled", "Ignored"]);
const ScanChange = v.picklist([
  "New",
  "Different",
  "Removed",
  "Same",
  "Unknown",
]);

const ApiFile = v.object({
  bytes: v.number(),
  change: ScanChange,
  ignored: v.optional(v.boolean()),
});
const ApiGame = v.object({
  decision: OperationStepDecision,
  files: v.record(v.string(), ApiFile),
  dump: v.optional(
    v.object({
      registry: v.optional(v.string()),
    })
  ),
});

export const BackupOutput = v.object({
  overall: OperationStatus,
  games: v.record(v.string(), ApiGame),
});
export type BackupOutput = v.InferOutput<typeof BackupOutput>;

export const BackupsOutput = v.object({
  games: v.record(
    v.string(),
    v.object({
      backupPath: v.string(),
    })
  ),
});

const ConfigOutput = v.object({
  backup: v.object({
    path: v.string(),
  }),
});
async function _getLudusaviConfig() {
  assert(ludusavi);

  const apiRet = await $`${ludusavi} config show --api`.json();
  return v.parse(ConfigOutput, apiRet);
}
export const getLudusaviConfig = pMemoize(_getLudusaviConfig);

export async function getLudusaviDir() {
  const config = await getLudusaviConfig();
  return config.backup.path;
}

export async function backupFiles(opts: {
  files?: (string | Path)[];
  registry?: string;
  tags?: string[];
  quiet?: boolean;
}) {
  assert(restic);

  const args = ["--no-scan"];
  args.push("--group-by", "host,tags");
  // args.push("--retry-lock", "5m");
  if (opts.quiet) args.push("--quiet");

  args.push("--tag", Env.RESTIC_TAGS);
  const tags = (opts.tags || []).map((s) => s.replaceAll(",", "_"));
  args.push("--tag", tags.join(","));

  if (Env.RCLONE_PATH) args.push("-o", `rclone.program=${Env.RCLONE_PATH}`);

  if (opts.files && opts.files.length) {
    const filesRaw = opts.files.join("\0") + "\0";
    const filesArgs = [...args];
    filesArgs.push("--tag", Env.RESTIC_FILES_TAGS);
    filesArgs.push("--files-from-raw", "-");
    await $`${restic} backup ${filesArgs}`.stdinText(filesRaw);
  }

  if (opts.registry) {
    const regArgs = [...args];
    regArgs.push("--tag", Env.RESTIC_REG_TAGS);
    regArgs.push("--stdin");
    regArgs.push("--stdin-filename", "registry.reg");
    await $`${restic} backup ${regArgs}`.stdinText(opts.registry);
  }
}

if (import.meta.main) {
  const AppData = Deno.env.get("AppData");
  if (!AppData) throw new Error("AppData not found");
  const vrc = $.path(AppData).join("..", "LocalLow", "VRChat");

  await backupFiles({
    files: [vrc],
    tags: ["VRChat", "Test"],
    registry: "This is a test.",
  });
}

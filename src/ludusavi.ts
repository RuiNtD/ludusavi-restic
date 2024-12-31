import $, { type Path } from "@david/dax";
import * as v from "@valibot/valibot";
import * as path from "@std/path";
import Env from "./env.ts";
import { ludusavi, restic } from "./exes.ts";

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

export async function getLudusaviDir() {
  if (!ludusavi) return;

  const apiRet = await $`${ludusavi} backups --api`.json();
  const backups = v.parse(BackupsOutput, apiRet);
  for (const game of Object.values(backups.games))
    if (game.backupPath) return path.dirname(game.backupPath);
}

export async function backupFiles(opts: {
  files?: (string | Path)[];
  registry?: string;
  tags?: string[];
  quiet?: boolean;
}) {
  if (!restic) return;

  const args = ["--no-scan"];
  args.push("--group-by", "host,tags");
  args.push("--retry-lock", "5m");
  if (opts.quiet) args.push("--quiet");

  args.push("--tag", Env.RESTIC_TAGS);
  const tags = (opts.tags || []).map((s) => s.replaceAll(",", "_"));
  args.push("--tag", tags.join(","));

  if (opts.files && opts.files.length) {
    const filesRaw = opts.files.join("\0") + "\0";
    const filesArgs = [...args];
    filesArgs.push("--tag", Env.RESTIC_FILES_TAGS);
    filesArgs.push("--files-from-raw", "-");
    let cmd = $`${restic} backup ${filesArgs}`.stdinText(filesRaw);
    if (opts.quiet) cmd = cmd.quiet();
    await cmd;
  }

  if (opts.registry) {
    const regArgs = [...args];
    regArgs.push("--tag", Env.RESTIC_REG_TAGS);
    regArgs.push("--stdin");
    regArgs.push("--stdin-filename", "registry.reg");
    let cmd = $`${restic} backup ${regArgs}`.stdinText(opts.registry);
    if (opts.quiet) cmd = cmd.quiet();
    await cmd;
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

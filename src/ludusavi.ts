import { $ } from "bun";
import * as v from "valibot";
import * as path from "path";
import { isTruthy } from "./helper";

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
  const apiRet = await $`ludusavi backups --api`.json();
  const backups = v.parse(BackupsOutput, apiRet);
  for (const game of Object.values(backups.games))
    if (game.backupPath) return path.dirname(game.backupPath);
}

export async function backupFiles(opts: {
  files: string[];
  tags?: string[];
  quiet?: boolean;
}) {
  const args = ["--skip-if-unchanged", "--no-scan"];
  args.push("--files-from-raw", "-");
  args.push("--group-by", "host,tags");
  args.push("--retry-lock", "5m");
  if (opts.quiet) args.push("--quiet");

  const tags = (opts.tags || [])
    .map((s) => s.trim().replaceAll(",", "_"))
    .filter(isTruthy);
  for (const tag of tags) args.push("--tag", tag);

  const stdin = new Response(opts.files.join("\0") + "\0");
  let cmd = $`restic backup ${args} < ${stdin}`;
  if (opts.quiet) cmd = cmd.quiet();
  return await cmd;
}

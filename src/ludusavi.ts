import { $ } from "bun";
import * as v from "valibot";
import * as path from "path";

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

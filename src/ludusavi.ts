import { $ } from "bun";
import z from "zod";
import * as path from "path";

const OperationStatus = z.object({
  processedBytes: z.number(),
  processedGames: z.number(),
  totalBytes: z.number(),
  totalGames: z.number(),
});
const OperationStepDecision = z.enum(["Processed", "Cancelled", "Ignored"]);
const ScanChange = z.enum(["New", "Different", "Removed", "Same", "Unknown"]);

const ApiFile = z.object({
  bytes: z.number(),
  change: ScanChange,
  ignored: z.boolean().optional(),
});
const ApiGame = z.object({
  decision: OperationStepDecision,
  files: z.record(ApiFile),
});

export const BackupOutput = z.object({
  overall: OperationStatus,
  games: z.record(ApiGame),
});
export type BackupOutput = z.infer<typeof BackupOutput>;

export const BackupsOutput = z.object({
  games: z.record(
    z.object({
      backupPath: z.string(),
    })
  ),
});

export async function getLudusaviDir() {
  const apiRet = await $`ludusavi backups --api`.json();
  const backups = BackupsOutput.parse(apiRet);
  for (const game of Object.values(backups.games))
    if (game.backupPath) return path.dirname(game.backupPath);
}

import $ from "@david/dax";
import z from "zod";

export const BackupOutput = z.object({
  overall: z.object({
    totalGames: z.number(),
    totalBytes: z.number(),
    processedGames: z.number(),
    processedBytes: z.number(),
  }),
  games: z.record(
    z.object({
      decision: z.enum(["Processed", "Cancelled", "Ignored"]),
      files: z.record(
        z.object({
          ignored: z.boolean().optional(),
        })
      ),
    })
  ),
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
    if (game.backupPath) return $.path(game.backupPath).parent();
}

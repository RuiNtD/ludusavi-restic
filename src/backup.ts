import { parseArgs } from "@std/cli/parse-args";
import { backupFiles, BackupOutput, getLudusaviDir } from "./ludusavi.ts";
import { prettyBytes } from "./helper.ts";
import dedent from "dedent";
import chalk from "chalk";
import * as v from "valibot";
import pMap from "p-map";

const { log } = console;
const { red, yellow, green, gray } = chalk;

const argv = parseArgs(Bun.argv.slice(2), {
  string: ["_"],
  collect: ["_"],
  boolean: ["help", "fullBackup"],
  alias: { h: "help", f: "fullBackup" },
});

if (argv.help) {
  log(dedent`
    $ ludusavi-restic [options] [Game...]

    -h, --help          Show this help
    -f, --fullBackup
      Do a full Ludusavi backup and back it up to Restic
  `);
  process.exit();
}

if (!Bun.env.RESTIC_REPOSITORY) {
  log(red("Environment not set up"));
  log("Copy .env.example to .env and edit it");
  process.exit(1);
}

if (!Bun.which("ludusavi")) {
  log(red("Could not find Ludusavi"));
  log("https://github.com/mtkennerly/ludusavi");
  process.exit(1);
}

if (!Bun.which("restic")) {
  log(red("Could not find Restic"));
  log("https://restic.net/");
  process.exit(1);
}

let backupData: BackupOutput;
try {
  const args = [...argv._, "--force", "--api"];
  if (argv.fullBackup) log("Backing up with Ludusavi...");
  else {
    log("Scanning with Ludusavi...");
    args.push("--preview");
  }
  // const ret = await $`ludusavi backup ${retArgs}`.json();
  const proc = Bun.spawn(["ludusavi", "backup", ...args]);
  const ret = await new Response(proc.stdout).json();
  backupData = v.parse(BackupOutput, ret);
} catch (e) {
  log(gray(e));
  process.exit(1);
}

if (argv.fullBackup) {
  const dir = await getLudusaviDir();
  if (!dir) log(yellow("Could not find Ludusavi directory"));
  else {
    log("Backing up", dir);
    await backupFiles({
      files: [dir],
      tags: [
        ...(Bun.env.RESTIC_TAGS || "").split(","),
        ...(Bun.env.RESTIC_FULL_TAGS ?? "Ludusavi").split(","),
      ],
    });
  }
}

const { overall } = backupData;
const { processedGames, totalGames } = overall;
const processedBytes = prettyBytes(overall.processedBytes);
const totalBytes = prettyBytes(overall.totalBytes);

log("Backing up with Restic...");
let gameIndex = 0;
// for (const [name, game] of Object.entries(backupData.games)) {
await pMap(
  Object.entries(backupData.games),
  async ([name, game]) => {
    if (game.decision == "Processed") {
      const fileSize = Object.values(game.files)
        .map(({ bytes }) => bytes)
        .reduce((a, b) => a + b, 0);
      const files = Object.entries(game.files)
        .filter(([_, data]) => !data.ignored)
        .filter(([_, data]) => data.change != "Removed")
        .map(([file, _]) => file);

      if (files.length)
        await backupFiles({
          files,
          tags: [
            name,
            ...(Bun.env.RESTIC_TAGS || "").split(","),
            ...(Bun.env.RESTIC_GAME_TAGS || "").split(","),
          ],
          quiet: true,
        });

      gameIndex++;
      let fileCounter =
        "[" +
        `${gameIndex}`.padStart(`${processedGames}`.length, " ") +
        ` / ${processedGames}]`;
      if (!files.length) fileCounter += red(" SKIPPING");
      log(gray(fileCounter), name, gray(`(${prettyBytes(fileSize)})`));
    }
  },
  { concurrency: 10 }
);
log();

log(green("Done!"));
log(gray(`Games: ${processedGames} / ${totalGames}`));
log(gray(`Size: ${processedBytes} / ${totalBytes}`));

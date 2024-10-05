import { $ } from "bun";
import { parseArgs } from "util";
import { BackupOutput, getLudusaviDir } from "./ludusavi.ts";
import { isTruthy, prettyBytes } from "./helper.ts";
import dedent from "dedent";
import chalk from "chalk";

const { log } = console;
const { red, yellow, green, gray } = chalk;

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
    fullBackup: { type: "boolean", short: "f" },
  },
  allowPositionals: true,
});

if (values.help) {
  log(dedent`
    Usage:
      $ ludusavi-restic [options] [Game...]

    Options:
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
  const args = [...positionals, "--force", "--api"];
  if (values.fullBackup) log("Backing up with Ludusavi...");
  else {
    log("Scanning with Ludusavi...");
    args.push("--preview");
  }
  // const ret = await $`ludusavi backup ${retArgs}`.json();
  const proc = Bun.spawn(["ludusavi", "backup", ...args]);
  const ret = await new Response(proc.stdout).json();
  backupData = BackupOutput.parse(ret);
} catch (e) {
  log(gray(e));
  process.exit(1);
}

if (values.fullBackup) {
  const dir = await getLudusaviDir();
  if (!dir) log(yellow("Could not find Ludusavi directory"));
  else {
    log("Backing up", dir);
    const args = [];
    const tags = [
      Bun.env.RESTIC_TAGS || "",
      Bun.env.RESTIC_FULL_BACKUP_TAGS ?? "Ludusavi",
    ]
      .map((s) => s.trim())
      .filter(isTruthy);
    for (const tag of tags) args.push("--tag", tag);

    await $`restic backup ${dir} ${args}`;
  }
}

const { overall } = backupData;
const { processedGames, totalGames } = overall;
const processedBytes = prettyBytes(overall.processedBytes);
const totalBytes = prettyBytes(overall.totalBytes);

log("Backing up with Restic...");
let gameIndex = 0;
for (const [name, game] of Object.entries(backupData.games)) {
  if (game.decision == "Processed") {
    gameIndex++;

    const fileSize = Object.values(game.files)
      .map(({ bytes }) => bytes)
      .reduce((a, b) => a + b, 0);
    const files = Object.entries(game.files)
      .filter(([_, data]) => !data.ignored)
      .filter(([_, data]) => data.change != "Removed")
      .map(([file, _]) => file);
    const fileCounter =
      "[" +
      `${gameIndex}`.padStart(`${processedGames}`.length, " ") +
      ` / ${processedGames}]`;

    if (files.length) {
      log(gray(fileCounter), name, gray(`(${prettyBytes(fileSize)})`));
      const args = ["--quiet", "--files-from-raw", "-"];
      const tags = [
        name.replaceAll(",", "_"),
        Bun.env.RESTIC_TAGS || "",
        Bun.env.RESTIC_GAME_TAGS || "",
      ]
        .map((s) => s.trim())
        .filter(isTruthy);
      for (const tag of tags) args.push("--tag", tag);

      const stdin = new Response(files.join("\0") + "\0");
      await $`restic backup ${args} < ${stdin}`;
    } else log(gray(fileCounter), red("SKIPPING"), name, gray("(0 B)"));
  }
}
log();

log(green("Done!"));
log(gray(`Games: ${processedGames} / ${totalGames}`));
log(gray(`Size: ${processedBytes} / ${totalBytes}`));

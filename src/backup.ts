import { $ } from "bun";
import { parseArgs } from "util";
import { BackupOutput, getLudusaviDir } from "./ludusavi.ts";
import prettyBytes from "pretty-bytes";
import { isTruthy } from "./helper.ts";
import dedent from "dedent";
import chalk from "chalk";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
    fullBackup: { type: "boolean", short: "f" },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(dedent`
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
  console.log(chalk.red("Environment not set up"));
  console.log("Copy .env.example to .env and edit it");
  process.exit(1);
}

if (!Bun.which("ludusavi")) {
  console.log(chalk.red("Could not find Ludusavi"));
  console.log("https://github.com/mtkennerly/ludusavi");
  process.exit(1);
}
if (!Bun.which("restic")) {
  console.log(chalk.red("Could not find Restic"));
  console.log("https://restic.net/");
  process.exit(1);
}

let backupData: BackupOutput;
try {
  const args = [...positionals, "--force", "--api"];
  if (values.fullBackup) console.log("Backing up with Ludusavi...");
  else {
    console.log("Scanning with Ludusavi...");
    args.push("--preview");
  }
  // const ret = await $`ludusavi backup ${retArgs}`.json();
  const proc = Bun.spawn(["ludusavi", "backup", ...args]);
  const ret = await new Response(proc.stdout).json();
  backupData = BackupOutput.parse(ret);
} catch (e) {
  console.log(chalk.gray(e));
  process.exit(1);
}

if (values.fullBackup) {
  const dir = await getLudusaviDir();
  if (!dir) console.log(chalk.yellow("Could not find Ludusavi directory"));
  else {
    console.log("Backing up", dir);
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
const processedBytes = prettyBytes(overall.processedBytes, { binary: true });
const totalBytes = prettyBytes(overall.totalBytes, { binary: true });

console.log("Backing up with Restic...");
let gameIndex = 0;
for (const [name, game] of Object.entries(backupData.games)) {
  if (game.decision == "Processed") {
    gameIndex++;
    console.log(chalk.gray(`[${gameIndex} / ${processedGames}]`), name);

    const files = Object.entries(game.files)
      .filter(([_, data]) => !data.ignored)
      .map(([file, _]) => file);

    if (files.length) {
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
    }
  }
}
console.log();

console.log(chalk.green("Done!"));
console.log(chalk.gray(`Games: ${processedGames} / ${totalGames}`));
console.log(chalk.gray(`Size: ${processedBytes} / ${totalBytes}`));

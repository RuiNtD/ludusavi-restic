import $ from "@david/dax";
import "@std/dotenv/load";
import { parseArgs } from "@std/cli/parse-args";
import { BackupOutput, getLudusaviDir } from "./ludusavi.ts";
import { format as formatBytes } from "@std/fmt/bytes";
import { isTruthy } from "./helper.ts";

type Args = {
  _: string[];
  help: boolean;
  fullBackup: boolean;
};
const args: Args = parseArgs(Deno.args, {
  boolean: ["help", "fullBackup"],
  string: "_",
  collect: "_",
  alias: {
    help: "h",
    fullBackup: "f",
  },
});

if (args.help) {
  $.log($.dedent`
    Usage:
      $ ludusavi-restic [options] [Game...]

    Options:
      -h, --help          Show this help
      -f, --fullBackup
        Do a full Ludusavi backup and back it up to Restic
  `);
  Deno.exit();
}

if (!Deno.env.has("RESTIC_REPOSITORY")) {
  $.logError("Environment not set up", "");
  $.log("Copy .env.example to .env and edit it");
  Deno.exit(1);
}

if (!(await $.commandExists("ludusavi"))) {
  $.logError("Could not find Ludusavi", "");
  $.log("https://github.com/mtkennerly/ludusavi");
  Deno.exit(1);
}
if (!(await $.commandExists("restic"))) {
  $.logError("Could not find Restic", "");
  $.log("https://restic.net/");
  Deno.exit(1);
}

let backupData: BackupOutput;
try {
  const retArgs = args._;
  retArgs.push("--force", "--api");
  if (!args.fullBackup) retArgs.push("--preview");

  const ret = await $`ludusavi backup ${retArgs}`.json();
  backupData = BackupOutput.parse(ret);
} catch (e) {
  $.logLight(e);
  Deno.exit(1);
}

if (args.fullBackup) {
  const dir = await getLudusaviDir();
  if (!dir) $.logWarn("Could not find Ludusavi directory", "");
  else {
    await $.progress({
      prefix: "Backing up",
      message: dir.toString(),
    }).with(async () => {
      const resticArgs = [];
      const tags = [
        Deno.env.get("RESTIC_TAGS") || "",
        Deno.env.get("RESTIC_FULL_TAGS") || "",
      ]
        .map((s) => s.trim())
        .filter(isTruthy);
      for (const tag of tags) resticArgs.push("--tag", tag);
      // if (rclone)
      //   resticArgs.push(
      //     "-o",
      //     `rclone.program=${$.escapeArg(rclone.toString())}`
      //   );

      await $`restic backup ${dir} ${resticArgs}`;
    });
    $.logStep("Backed up", "Ludusavi directory");
  }
}

const { overall } = backupData;
const { processedGames, totalGames } = overall;
const processedBytes = formatBytes(overall.processedBytes, { binary: true });
const totalBytes = formatBytes(overall.totalBytes, { binary: true });

const pb = $.progress({
  prefix: "Backing up",
  message: "on Restic",
  length: processedGames,
});
await pb.with(async () => {
  for (const [name, game] of Object.entries(backupData.games)) {
    pb.message(name);
    if (game.decision == "Processed") {
      const files = Object.entries(game.files)
        .filter(([_, data]) => !data.ignored)
        .map(([file, _]) => file);

      if (files.length) {
        const resticArgs = ["--quiet", "--files-from-raw", "-"];
        const tags = [
          name.replaceAll(",", "_"),
          Deno.env.get("RESTIC_TAGS") || "",
          Deno.env.get("RESTIC_GAME_TAGS") || "",
        ]
          .map((s) => s.trim())
          .filter(isTruthy);
        for (const tag of tags) resticArgs.push("--tag", tag);

        const stdin = files.join("\0") + "\0";
        await $`restic backup ${resticArgs}`.stdinText(stdin);
      }
    }
    pb.increment();
  }
});

$.logStep("Done!");
$.logLight(`Games: ${processedGames} / ${totalGames}`);
$.logLight(`Size: ${processedBytes} / ${totalBytes}`);

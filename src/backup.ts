#!/usr/bin/env -S deno run -A

import { parseArgs } from "@std/cli/parse-args";
import { backupFiles, BackupOutput, getLudusaviDir } from "./ludusavi.ts";
import { prettyBytes } from "./helper.ts";
import dedent from "dedent";
import * as v from "@valibot/valibot";
import * as process from "node:process";
import $ from "@david/dax";
import Env from "./env.ts";
import { ludusavi, restic } from "./exes.ts";

const argv = parseArgs(Deno.args, {
  string: ["_"],
  collect: ["_"],
  boolean: ["help", "fullBackup"],
  alias: {
    help: "h",
    fullBackup: ["full-backup", "f"],
  },
});

if (argv.help) {
  $.log(dedent`
    $ ludusavi-restic [options] [Game...]

    -h, --help          Show this help
    -f, --full-backup
      Do a full Ludusavi backup and back it up to Restic
  `);
  process.exit();
}

if (!Env.RESTIC_REPOSITORY) {
  $.logError("Environment not set up");
  $.log("Copy .env.example to .env and edit it");
  process.exit(1);
}

if (!ludusavi) {
  $.logError("Could not find Ludusavi");
  $.log("https://github.com/mtkennerly/ludusavi");
  process.exit(1);
}

if (!restic) {
  $.logError("Could not find Restic");
  $.log("https://restic.net/");
  process.exit(1);
}

let backupData: BackupOutput;
try {
  const args = [...argv._, "--force", "--api", "--dump-registry"];
  if (argv.fullBackup) $.log("Backing up with Ludusavi...");
  else {
    $.logStep("Scanning with Ludusavi...");
    args.push("--preview");
  }
  const ret = await $`${ludusavi} backup ${args}`.json();
  backupData = v.parse(BackupOutput, ret);
} catch (e) {
  $.logLight(e);
  process.exit(1);
}

if (argv.fullBackup) {
  const dir = await getLudusaviDir();
  $.logStep("Backing up", dir);
  await backupFiles({
    files: [dir],
    tags: Env.RESTIC_FULL_TAGS.split(","),
  });
}

const { overall } = backupData;
const { processedGames, totalGames } = overall;
const processedBytes = prettyBytes(overall.processedBytes);
const totalBytes = prettyBytes(overall.totalBytes);

const pb = $.progress({
  prefix: "Backing up",
  length: processedGames,
});
await pb.with(async () => {
  for (const [name, game] of Object.entries(backupData.games)) {
    if (game.decision == "Processed") {
      pb.message(name);

      const files = Object.entries(game.files)
        .filter(([_, data]) => !data.ignored)
        .filter(([_, data]) => data.change != "Removed")
        .map(([file, _]) => file);

      if (files.length)
        await backupFiles({
          files,
          registry: game.dump?.registry,
          tags: [name, ...Env.RESTIC_GAME_TAGS.split(",")],
          quiet: true,
        });

      pb.increment();
    }
  }
});
$.log();

$.logStep("Done!");
$.logLight(`Games: ${processedGames} / ${totalGames}`);
$.logLight(`Size: ${processedBytes} / ${totalBytes}`);

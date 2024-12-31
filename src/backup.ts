#!/usr/bin/env -S deno run -A

import { parseArgs } from "@std/cli/parse-args";
import { backupFiles, BackupOutput, getLudusaviDir } from "./ludusavi.ts";
import { prettyBytes } from "./helper.ts";
import dedent from "dedent";
import * as v from "@valibot/valibot";
import pMap from "p-map";
import * as process from "node:process";
import $ from "@david/dax";
import { red, yellow, green, gray } from "@std/fmt/colors";
import Env from "./env.ts";
import { ludusavi, restic } from "./exes.ts";

const argv = parseArgs(Deno.args, {
  string: ["_"],
  collect: ["_"],
  boolean: ["help", "fullBackup"],
  alias: { h: "help", f: "fullBackup" },
});

if (argv.help) {
  $.log(dedent`
    $ ludusavi-restic [options] [Game...]

    -h, --help          Show this help
    -f, --fullBackup
      Do a full Ludusavi backup and back it up to Restic
  `);
  process.exit();
}

if (!Env.RESTIC_REPOSITORY) {
  $.log(red("Environment not set up"));
  $.log("Copy .env.example to .env and edit it");
  process.exit(1);
}

if (!ludusavi) {
  $.log(red("Could not find Ludusavi"));
  $.log("https://github.com/mtkennerly/ludusavi");
  process.exit(1);
}

if (!restic) {
  $.log(red("Could not find Restic"));
  $.log("https://restic.net/");
  process.exit(1);
}

let backupData: BackupOutput;
try {
  const args = [...argv._, "--force", "--api" /*, "--dump-registry" */];
  if (argv.fullBackup) $.log("Backing up with Ludusavi...");
  else {
    $.log("Scanning with Ludusavi...");
    args.push("--preview");
  }
  const ret = await $`${ludusavi} backup ${args}`.json();
  backupData = v.parse(BackupOutput, ret);
} catch (e) {
  $.log(gray(`${e}`));
  process.exit(1);
}

if (argv.fullBackup) {
  const dir = await getLudusaviDir();
  if (!dir) $.log(yellow("Could not find Ludusavi directory"));
  else {
    $.log("Backing up", dir);
    await backupFiles({
      files: [dir],
      tags: Env.RESTIC_FULL_TAGS.split(","),
    });
  }
}

const { overall } = backupData;
const { processedGames, totalGames } = overall;
const processedBytes = prettyBytes(overall.processedBytes);
const totalBytes = prettyBytes(overall.totalBytes);

$.log("Backing up with Restic...");
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
          registry: game.dump?.registry,
          tags: [name, ...Env.RESTIC_GAME_TAGS.split(",")],
          quiet: true,
        });

      gameIndex++;
      const fileCounter =
        "[" +
        `${gameIndex}`.padStart(`${processedGames}`.length, " ") +
        ` / ${processedGames}]`;
      $.log(gray(fileCounter), name, gray(`(${prettyBytes(fileSize)})`));
    }
  },
  { concurrency: 10 }
);
$.log();

$.log(green("Done!"));
$.log(gray(`Games: ${processedGames} / ${totalGames}`));
$.log(gray(`Size: ${processedBytes} / ${totalBytes}`));

import Env from "./env.ts";
import $ from "@david/dax";

export const ludusavi = Env.LUDUSAVI_PATH || (await $.which("ludusavi"));

// TODO: I want to default to Rustic, a Restic implmentation in Rust,
// but Rustic doesn't yet support --files-from-raw
export const restic = Env.RESTIC_PATH || (await $.which("restic"));

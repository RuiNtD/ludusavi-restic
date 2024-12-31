import "@std/dotenv/load";
import * as v from "@valibot/valibot";

const EnvObj = v.looseObject({
  RESTIC_REPOSITORY: v.string(),

  RESTIC_TAGS: v.optional(v.string(), ""),
  RESTIC_FULL_TAGS: v.optional(v.string(), "Ludusavi"),
  RESTIC_GAME_TAGS: v.optional(v.string(), ""),

  RESTIC_FILES_TAGS: v.optional(v.string(), ""),
  RESTIC_REG_TAGS: v.optional(v.string(), "Registry"),

  LUDUSAVI_PATH: v.optional(v.string()),
  RESTIC_PATH: v.optional(v.string()),
});
const Env = v.parse(EnvObj, Deno.env.toObject());
export default Env;

if (import.meta.main) {
  console.log(Env);
}

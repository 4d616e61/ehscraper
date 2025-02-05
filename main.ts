import { assert } from "@std/assert/assert";
import { DataDB } from "./data/db.ts";
import { Scraper } from "./scrape/scraper.ts";
import { SyncDB } from "./sync/db.ts";
import { TaskType } from "./sync/task.ts";
import { sleep } from "./utils/utils.ts";
import { parse } from "@std/jsonc";
// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  // i hate this so much
  const decoder = new TextDecoder("utf-8");

  const _config_dat = Deno.readFileSync("./config.jsonc");
  const config = parse(decoder.decode(_config_dat));
  assert(config != null);
  const config_sync = config["sync"];

  const sdb: SyncDB = new SyncDB(
    "./syncdb.db",
    config_sync["autogen_new_tasks"],
    config_sync["max_generated_tasks"],
    //placeholder
    0,
    config_sync["max_ids_per_task"],
  );
  const ddb: DataDB = new DataDB("./datadb.db");
  const scraper_norm: Scraper = new Scraper(sdb, ddb, TaskType.NORM);
  console.log("Getting current max gid: ");
  const max_gid = await scraper_norm.get_max_gid();
  console.log(`GID: ${max_gid}`);
  sdb.max_id = max_gid;
  //const max_gid = 1000000;
  scraper_norm.pagination_loop();
  scraper_norm.query_loop();
  await sleep(100000000);
}

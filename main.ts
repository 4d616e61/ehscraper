import { assert } from "@std/assert/assert";
import { DataDB } from "./data/db.ts";
import { Scraper } from "./scrape/scraper.ts";
import { SyncDB } from "./sync/db.ts";
import { TaskType } from "./sync/task.ts";
import { sleep } from "./utils/utils.ts";
import { parse } from "@std/jsonc";
import config from "./config.json" with { type: "json" };
// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  const sdb: SyncDB = new SyncDB(
    "./syncdb.db",
    config.sync.autogen_new_tasks,
    config.sync.max_generated_tasks,
    //placeholder
    0,
    config.sync.max_ids_per_task,
  );
  const ddb: DataDB = new DataDB("./datadb.db");
  const scraper_norm: Scraper = new Scraper(sdb, ddb, TaskType.NORM);
  console.log("Getting current max gid: ");
  const max_gid = await scraper_norm.get_max_gid();
  console.log(`GID: ${max_gid}`);
  sdb.max_id = max_gid;
  //const max_gid = 1000000;
  if (config.scrape.use_auth) {
    const scraper_authed: Scraper = new Scraper(
      sdb,
      ddb,
      TaskType.EXH,
      config.scrape.cookies,
    );
    scraper_authed.pagination_loop();
  }
  scraper_norm.pagination_loop();
  scraper_norm.query_loop();
  await sleep(100000000);
}

import { DataDB } from "./data/db.ts";
import { Scraper } from "./scrape/scraper.ts";
import { SyncDB } from "./sync/db.ts";
import { TaskType } from "./sync/task.ts";
import { config } from "./config.jsonc" with { type: "json" };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function paginate_loop() {
  while (true) {
  }
}
async function query_loop() {
  while (true) {
  }
}
// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  const sdb: SyncDB = new SyncDB("./syncdb.db");
  const ddb: DataDB = new DataDB("./datadb.db");
  const scraper_norm: Scraper = new Scraper(sdb, ddb);
  const max_gid = await scraper_norm.get_max_gid();
  //const max_gid = 1000000;
  sdb.generate_tasks(16, max_gid, 5000);
  while (true) {
    const task = sdb.get_task(TaskType.NORM);
    if (task == null) {
      break;
    }
    scraper_norm.execute_pagination_task(task).catch();
    scraper_norm.execute_pagination_task(task);
    break;
  }
  const api_q = sdb.get_queries();
  if (api_q.length == 0) {
    await sleep(10000000);
  }
  scraper_norm.execute_api_query(api_q);
  await sleep(100000000);
}

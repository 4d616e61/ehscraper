import { assert } from "@std/assert/assert";
import { DataDB } from "./data/db.ts";
import { Scraper } from "./scrape/scraper.ts";
import { SyncDB } from "./sync/db.ts";
import { TaskType } from "./sync/task.ts";
import { sleep } from "./utils/utils.ts";
import config from "./config.json" with { type: "json" };
import { ProxyProvider, SimpleProxyProvider } from "./scrape/proxyprovider.ts";
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
  const scraper_norm: Scraper = new Scraper(
    sdb,
    ddb,
    TaskType.NORM,
    undefined,
    //new SimpleProxyProvider(config.scrape.proxies, false),
  );
  const scraper_api: Scraper = new Scraper(
    sdb,
    ddb,
    TaskType.NORM,
    undefined,
    //new SimpleProxyProvider(config.scrape.proxies, false),
  );
  console.log("Getting current max gid: ");
  const max_gid = await scraper_norm.get_max_gid();
  console.log(`GID: ${max_gid}`);
  sdb.max_id = max_gid;

  //placeholder for task declaration
  let tsk = sleep(0);
  await tsk;
if (config.scrape.use_auth) {
    const scraper_authed: Scraper = new Scraper(
      sdb,
      ddb,
      TaskType.ALL,
      config.scrape.cookies,
    );
    tsk = scraper_authed.pagination_loop(5000);
  }
  //scraper_norm.pagination_loop(125);
  //sync tasks
  await scraper_api.query_loop(1000);
  await tsk;
}



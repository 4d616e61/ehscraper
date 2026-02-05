import { assert } from "@std/assert/assert";
import { DataDB } from "./data/db.ts";
import { Scraper } from "./scrape/scraper.ts";
import { SyncDB } from "./sync/db.ts";
import { TaskType } from "./sync/task.ts";
import { sleep } from "./utils/utils.ts";
import config from "./config.json" with { type: "json" };
import { ProxyProvider, SimpleProxyProvider } from "./scrape/proxyprovider.ts";

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

  const api_scraper: Scraper = new Scraper(
    sdb,
    ddb,
    TaskType.NORM,
    undefined,
    //new SimpleProxyProvider(config.scrape.proxies, false),
  );
  const is_unauthed = !config.scrape.use_auth;
  const page_scraper = is_unauthed
    ? new Scraper(
      sdb,
      ddb,
      TaskType.NORM,
      undefined,
    )
    : new Scraper(
      sdb,
      ddb,
      TaskType.ALL,
      config.scrape.cookies,
    );
  console.log("Getting current max gid: ");
  const max_gid = await page_scraper.get_max_gid();
  console.log(`GID: ${max_gid}`);
  sdb.max_id = max_gid;

  let tsk = page_scraper.pagination_loop(5000);

  //scraper_norm.pagination_loop(125);
  //sync tasks
  await api_scraper.query_loop(1000);
  await tsk;
}

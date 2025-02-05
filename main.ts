import { DataDB } from "./data/db.ts";
import { parse_page } from "./scrape/parse.ts";
import { Scraper } from "./scrape/scraper.ts";
import { SyncDB } from "./sync/db.ts"
import { TaskType } from "./sync/task.ts";

export function add(a: number, b: number): number {
  return a + b;
}

function sleep(ms : number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {


  const sdb : SyncDB = new SyncDB("./syncdb.db")
  const ddb : DataDB = new DataDB("./datadb.db")
  const scraper_norm : Scraper = new Scraper(sdb, ddb)
  sdb.generate_tasks(16, 3090, 200)
  while( true ){
    const task = sdb.get_task(TaskType.NORM)
    if(task == null)
      break;
    //scraper_norm.execute_pagination_task(task)
    break;
  }
  const api_q = sdb.get_queries();
  scraper_norm.execute_api_query(api_q);
  await sleep(100000000);


}

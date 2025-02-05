import { assert } from "@std/assert/assert";
import { DataDB } from "../data/db.ts";
import { SyncDB } from "../sync/db.ts";
import { Task } from "../sync/task.ts";
import { parse_page, ParsedPage } from "./parse.ts";

export class Scraper {
  //sl: "dm_2"
  //^cookie for extended layout
  private _syncdb: SyncDB;
  private _datadb: DataDB;
  private _api_endpoint: string;
  private _cookie: string;
  constructor(
    sdb: SyncDB,
    ddb: DataDB,
    api_endpoint = "https://api.e-hentai.org/api.php",
  ) {
    this._syncdb = sdb;
    this._datadb = ddb;
    this._cookie = "";
    this._api_endpoint = api_endpoint;
  }

  private async make_page_request(next: number, is_expunged: boolean) {
    const expunged_string = is_expunged ? "on" : "";
    const response = await fetch(
      `https://e-hentai.org?next=${next}&f_cats=0&advsearch=1&f_sname=on&f_stags=on&f_sh=${expunged_string}`,
      {
        headers: {
          cookie: this._cookie + "sl=dm_2",
        },
      },
    );
    if (response.status != 200) {
      return Promise.reject(`Request failed with code ${response.status}`);
    }
    return response;
  }

  public async get_max_gid() {
    const res = await this.make_page_request(0, false);
    const page: ParsedPage = parse_page(await res.text());
    return page.entries[0].gid;
  }

  public async execute_pagination_task(task: Task) {
    const expunged_iterator = [false, true];
    for (const do_expunged of expunged_iterator) {
      //sounds weird, but this goes from end to start

      let cur_next = task.end;
      console.log(`Expunged: ${do_expunged}`);
      console.log(`Paginating from ${cur_next}`);
      //TODO: verify cookies
      const response = await this.make_page_request(cur_next, do_expunged);
      //console.log(response.status);  // e.g. 200
      if (response.status != 200) {
        return Promise.reject(`Request failed with code ${response.status}`);
      }

      const res_text: string = await response.text();

      let page: ParsedPage = undefined;
      try {
        page = parse_page(res_text);
      } catch (error) {
        return Promise.reject(error);
      }

      //save, parse results, etc etc
      //
      console.log(`Next: ${page.next}`);
      cur_next = page.next;
      if (cur_next < task.start) {
        continue;
      }
      //TODO: handle error

      for (const entry of page.entries) {
        this._datadb.add_page_entry(entry);
        this._syncdb.add_page_entry(entry);
      }
    }
    this._syncdb.resolve_task(task);
    console.log(`Resolved task: `);
    console.log(task);
  }

  // deno-lint-ignore no-explicit-any
  public async execute_api_query(query: Array<any>) {
    assert(query.length > 0);
    assert(query[0].length == 2);

    const response = await fetch(this._api_endpoint, {
      method: "POST",
      body: JSON.stringify({
        method: "gdata",
        gidlist: query,
        namespace: 1,
      }),
    });
    if (response.status != 200) {
      for (const entry of query) {
        this._syncdb.unresolve_query(entry[0]);
      }

      return Promise.reject(`Request failed with code ${response.status}`);
    }

    const resp_json = await response.json();
    for (const entry of resp_json["gmetadata"]) {
      const gid = entry["gid"];
      if ("error" in entry) {
        this._syncdb.unresolve_query(gid);
        continue;
      }
      this._datadb.add_api_resp(entry);
      this._syncdb.resolve_query(gid);
    }
  }
}

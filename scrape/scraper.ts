import { assert } from "@std/assert/assert";
import { DataDB } from "../data/db.ts";
import { SyncDB } from "../sync/db.ts";
import { Task } from "../sync/task.ts";
import { is_ip_banned, parse_page, ParsedPage } from "./parse.ts";
import { sleep, sleep_await } from "../utils/utils.ts";
import { TaskType } from "../sync/task.ts";
import { ProxyProvider, RequestProxy } from "./proxyprovider.ts";
export class Scraper {
  //sl: "dm_2"
  //^cookie for extended layout
  private _syncdb: SyncDB;
  private _datadb: DataDB;
  private _api_endpoint: string;
  private _cookie: string;
  private _accepted_type: TaskType;
  private _exh_search: string =
    "~lolicon+~shotacon+~beastality+~toddlercon+~abortion";
  private _proxy_provider: ProxyProvider;
  private _http_client: Deno.HttpClient;
  private _active_proxy?: RequestProxy;
  constructor(
    sdb: SyncDB,
    ddb: DataDB,
    accepted_type: TaskType,
    cookie: string = "",
    //Base proxy provider doesnt do anything
    proxy_provider: ProxyProvider = new ProxyProvider(),
    api_endpoint = "https://api.e-hentai.org/api.php",
  ) {
    this._syncdb = sdb;
    this._datadb = ddb;
    this._accepted_type = accepted_type;
    this._cookie = cookie;
    this._api_endpoint = api_endpoint;
    this._proxy_provider = proxy_provider;
    this._http_client = Deno.createHttpClient({});
    // this._active_proxy = undefined;
    this.switch_proxy();
  }

  private switch_proxy(): boolean {
    const proxy = this._proxy_provider.get_proxy();
    if (proxy) {
      this._active_proxy = proxy;

      this._http_client = Deno.createHttpClient({ proxy: this._active_proxy });
      return true;
    }
    this._http_client = Deno.createHttpClient({});
    return false;
  }

  private _fetch_wrapper(url: string, request_init: RequestInit) {
    //this sucks but i dont care
    const request_init_any: any = request_init;
    request_init_any.client = this._http_client;
    return fetch(url, request_init);
  }

  private async make_page_request(
    next: number,
    is_expunged: boolean,
    search_string: string = "",
    do_exhentai: boolean = false,
  ) {
    const expunged_string = is_expunged ? "on" : "";
    let cookie = this._cookie.replaceAll(/sl=[^;]+;?/g, "");
    cookie += cookie.endsWith(";") ? "" : ";";
    cookie += "sl=dm_2";
    const response = await this._fetch_wrapper(
      `https://e${
        do_exhentai ? "x" : "-"
      }hentai.org?next=${next}&f_sfl=on&f_sfu=on&f_sft=on&f_cats=0&advsearch=1&f_sh=${expunged_string}`,
      {
        headers: {
          cookie: cookie,
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
  private async test_and_handle_ipban(
    res_text: string,
    fail_timeout: number = 10000,
  ) {
    if (!is_ip_banned(res_text)) {
      return false;
    }

    console.log("IP Ban detected. Attempting to switch proxies.");
    if (this._active_proxy) {
      this._proxy_provider.invalidate_proxy(this._active_proxy);
    }
    if (!this.switch_proxy()) {
      console.log(
        `Unable to switch proxies. Sleeping for ${
          fail_timeout / 1000
        } seconds.`,
      );
      await sleep(fail_timeout);
    }
    return true;
  }

  public async execute_pagination_task(task: Task, delay: number = 5000) {
    const expunged_iterator = [false, true];
    for (const do_expunged of expunged_iterator) {
      //sounds weird, but this goes from end to start
      let cur_next = task.end;
      console.log(`Expunged: ${do_expunged}`);
      while (true) {
        console.log(`Paginating from ${cur_next}`);
        //TODO: verify cookies
        const search_string: string = this._accepted_type == TaskType.EXH
          ? this._exh_search
          : "";
        const do_exhentai: boolean = this._accepted_type == TaskType.NORM
          ? false
          : true;
        const response = await this.make_page_request(
          cur_next,
          do_expunged,
          search_string,
          do_exhentai,
        );
        const res_text: string = await response.text();
        //console.log(response.status);  // e.g. 200
        const ipban = await this.test_and_handle_ipban(res_text, delay * 10);
        if (ipban) {
          continue;
        }
        if (response.status != 200) {
          return Promise.reject(`Request failed with code ${response.status}`);
        }

        const page = parse_page(res_text);

        //save, parse results, etc etc
        //
        //console.log(`Next: ${page.next}`);

        //TODO: handle error

        for (const entry of page.entries) {
          this._datadb.add_page_entry(entry);
          this._syncdb.add_page_entry(entry);
        }
        cur_next = page.next;
        await sleep(delay);
        if (cur_next < task.start) {
          break;
        }
      }
    }
    this._syncdb.resolve_task(task);
    console.log(`Resolved task: `);
    console.log(task);
    return true;
  }

  // deno-lint-ignore no-explicit-any
  public async execute_api_query(query: Array<any>) {
    assert(query.length > 0);
    assert(query[0].length === 2);
    console.log(`Querying ${query.length} entries...`);
    const response = await this._fetch_wrapper(this._api_endpoint, {
      method: "POST",
      body: JSON.stringify({
        method: "gdata",
        gidlist: query,
        namespace: 1,
      }),
    });
    const resp_text = await response.text();
    const ip_banned = await this.test_and_handle_ipban(resp_text, 1000 * 10);
    if (response.status != 200 || ip_banned) {
      for (const entry of query) {
        this._syncdb.unresolve_query(entry[0]);
      }

      return Promise.reject(
        `Request failed with code ${response.status}, ip ban status: ${ip_banned}`,
      );
    }
    const resp_json = JSON.parse(resp_text);
    for (const entry of resp_json["gmetadata"]) {
      const gid = entry["gid"];
      if ("error" in entry) {
        console.log(`gid: ${gid} failed`);
        this._syncdb.unresolve_query(gid);
        continue;
      }
      this._datadb.add_api_resp(entry);
      this._syncdb.resolve_query(gid);
    }
    return true;
  }
  public async pagination_loop(delay: number = 5000) {
    let attempts = 0;
    const max_attempts = 25;
    while (true) {
      const task = this._syncdb.get_task(this._accepted_type);
      if (task === null) {
        attempts++;
        console.log(
          `No more pagination tasks. Retrying in ${
            delay * 10 / 1000
          } seconds... (attempt ${attempts} of ${max_attempts})`,
        );
        await sleep(delay * 10);
        continue;
      }
      //TODO: unregister task on fail
      console.log("Executing task:");
      console.log(task);
      const success = await this.execute_pagination_task(task, delay).catch(
        (reason) => {
          this._syncdb.unresolve_task(task);
          console.log("Failed to execute task: ");
          console.log(task);
          console.log(`Exception: ${reason}`);
          console.log(`Retrying in ${delay * 10 / 1000} seconds...`);
          return false;
        },
      );
      attempts = 0;
      if (success) {
        //pass
      } else {
        await sleep(delay * 10);
      }
    }
  }
  public async query_loop(delay: number = 5000) {
    let attempts = 0;
    const max_attempts = 25;
    while (true) {
      false;
      const query = this._syncdb.get_queries();
      if (query.length === 0) {
        attempts++;
        //if (attempts >= max_attempts) {
        if (false) {
          console.log(
            `No query tasks after ${max_attempts} tries. Exiting query loop.`,
          );
          return;
        }
        console.log(
          `No query tasks available. Retrying after 1 second. Attempt ${attempts} of ${max_attempts}`,
        );

        await sleep(1000);
        continue;
      }
      attempts = 0;
      const success = await this.execute_api_query(query).catch(
        (reason) => {
          //this._syncdb.unresolve_task(task);
          console.log("Failed to execute query.");
          //console.log(task);
          console.log(`Exception: ${reason}`);
          console.log(`Retrying in ${delay * 10 / 1000} seconds...`);
          return false;
        },
      );
      if (success) {
        await sleep(delay);
      } else {
        await sleep(delay * 10);
      }
    }
  }
}

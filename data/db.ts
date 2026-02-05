import { assert } from "@std/assert/assert";
import { Database } from "@db/sqlite";
import { ParsedEntry } from "../scrape/parse.ts";
import { get_ts } from "../utils/utils.ts";

export const S_SYNCING = "S",
  S_FINISHED = "F",
  S_UNSYNCED = "N",
  S_REDUNDANT = "R";
//(redundant = not actually finished, but probably isnt needed)

export class DataDB {
  private path: string;
  private _db: Database;

  constructor(path: string) {
    assert(path != null);

    this.path = path;
    this._db = new Database(this.path);
    this.init_db();
  }

  private init_db() {
    // maybe also track timestamp to ensure no conflict between downloads
    this._db.prepare(
      `
              CREATE TABLE IF NOT EXISTS gid_token (
                gid           INTEGER,
                token         TEXT,
                PRIMARY KEY(gid)
              );
            `,
    ).run();

    //json
    this._db.prepare(
      `
              CREATE TABLE IF NOT EXISTS paged_tags (
              gid                 INTEGER,
              tags_solid          TEXT,
              tags_dashed         TEXT,
              resp_ts             INTEGER,
              PRIMARY KEY(gid)
              );
            `,
    ).run();

    this._db.prepare(
      `
              CREATE TABLE IF NOT EXISTS api_response (
              gid                 INTEGER,
              resp                TEXT,
              resp_ts             INTEGER,
              PRIMARY KEY(gid)
              );
            `,
    ).run();
  }

  public add_page_entry(entry: ParsedEntry) {
    this._db.prepare(
      "INSERT OR REPLACE INTO paged_tags (gid, tags_solid, tags_dashed, resp_ts) VALUES (?, ?, ?, ?)",
    )
      .run(
        entry.gid,
        JSON.stringify(entry.tags_solid),
        JSON.stringify(entry.tags_dashed),
        get_ts(),
      );

    this._db.prepare(
      "INSERT OR REPLACE INTO gid_token (gid, token) VALUES (?, ?)",
    )
      .run(entry.gid, entry.token);
  }

  // deno-lint-ignore no-explicit-any
  public add_api_resp(metadata_obj: any) {
    const gid = metadata_obj["gid"];
    this._db.prepare(
      "INSERT OR REPLACE INTO api_response (gid, resp, resp_ts) VALUES (?, ?, ?)",
    )
      .run(gid, JSON.stringify(metadata_obj), get_ts());
  }
}

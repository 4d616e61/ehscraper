import { assert } from "@std/assert/assert";
import { Database } from "jsr:@db/sqlite@0.12";
import { ParsedEntry } from "../scrape/parse.ts";

export const S_SYNCING = "S", S_FINISHED = "F", S_UNSYNCED = "N", S_REDUNDANT = "R"
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
              tags_strong         TEXT,
              tags_dashed         TEXT,
              PRIMARY KEY(gid)
              );
            `,
    ).run();
    
    this._db.prepare(
      `
              CREATE TABLE IF NOT EXISTS api_response (
              gid                 INTEGER,
              resp                TEXT,
              PRIMARY KEY(gid)
              );
            `,
    ).run();
  }

  public add_page_entry( entry : ParsedEntry ) {
    this._db.prepare("INSERT OR REPLACE INTO paged_tags (gid, tags_strong, tags_dashed) VALUES (?, ?, ?)")
    .run(entry.gid, JSON.stringify(entry.tags_strong), JSON.stringify(entry.tags_dashed))
    
    this._db.prepare("INSERT OR REPLACE INTO gid_token (gid, token) VALUES (?, ?)")
    .run(entry.gid, entry.token)

  }

  public add_api_resp(metadata_obj : any) {
    const gid = metadata_obj["gid"]
    this._db.prepare("INSERT OR REPLACE INTO api_response (gid, resp) VALUES (?, ?)")
    .run(gid, JSON.stringify(metadata_obj))
  }
}

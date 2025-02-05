import { assert } from "@std/assert/assert";
import { Database } from "@db/sqlite";
import { Task, task_type_to_name, TaskType } from "./task.ts";
import { ParsedEntry } from "../scrape/parse.ts";

export const S_SYNCING = "S",
  S_FINISHED = "F",
  S_UNSYNCED = "N",
  S_REDUNDANT = "R";
//(redundant = not actually finished, but probably isnt needed)

export class SyncDB {
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
              CREATE TABLE IF NOT EXISTS tasks (
                task_id INTEGER PRIMARY KEY AUTOINCREMENT,
                start           INTEGER,
                end             INTEGER,
                status_all      CHAR(1),
                status_normal   CHAR(1),
                status_exh      CHAR(1),
                UNIQUE(start, end)

              );
            `,
    ).run();
    this._db.prepare(
      `
              CREATE TABLE IF NOT EXISTS current_id (
                k CHAR(1),
                id INTEGER,
                PRIMARY KEY(k)
              );
            `,
    ).run();

    //i honestly thought about using the data db for this but i dont want control to be decided by that
    this._db.prepare(
      `
              CREATE TABLE IF NOT EXISTS api_query (
              gid       INTEGER,
              token     TEXT,
              status    CHAR(1),
              PRIMARY KEY(gid)
              );
            `,
    ).run();

    this._db.prepare(
      `
              INSERT OR IGNORE INTO current_id (k, id) VALUES ('K', 0);
            `,
    ).run();

    // Invalidate all tasks with status "running"

    //im sorry ok
    //TODO: make this look less hideous
    this._db.prepare(
      `UPDATE tasks SET status_all='${S_UNSYNCED}' WHERE status_all='${S_SYNCING}'`,
    ).run();
    this._db.prepare(
      `UPDATE tasks SET status_normal='${S_UNSYNCED}' WHERE status_normal='${S_SYNCING}'`,
    ).run();
    this._db.prepare(
      `UPDATE tasks SET status_exh='${S_UNSYNCED}' WHERE status_exh='${S_SYNCING}'`,
    ).run();
  }

  //dont use this
  public all_tasks_done(): boolean {
    //might be a better way to do this but i dont really care rn
    const res = this._db.prepare(
      `SELECT status_all FROM tasks WHERE status_all != ${S_FINISHED}`,
    ).all();
    return res.length === 0;
  }
  public generate_tasks(n_tasks: number, max_id: number, ids_per_task: number) {
    const res = this._db.prepare(`SELECT id FROM current_id`).all();
    assert(res.length === 1);
    //PROBABLY wont fail
    const cur_id: number = +res[0]["id"];
    const dst_id = cur_id + ids_per_task * n_tasks;
    if (cur_id >= max_id) {
      return;
    }

    //i hate this
    const tasks = [];
    for (let cur = cur_id; cur < dst_id; cur += ids_per_task) {
      const dst = cur + ids_per_task;
      if (dst > max_id) {
        tasks.push([cur, max_id]);
        break;
      }
      tasks.push([cur, dst]);
    }
    let final_end = 0;
    //TODO: multi insert
    for (const [start, end] of tasks) {
      final_end = Math.max(final_end, end);
      this._db.prepare(
        `INSERT INTO tasks (start, end, status_all, status_normal, status_exh) VALUES (?, ?, ?, ?, ?)`,
      )
        .all(start, end, S_UNSYNCED, S_UNSYNCED, S_UNSYNCED);
    }

    //update counter
    this._db.prepare("UPDATE current_id SET id = (?)").all(final_end);
  }

  public set_completed(task: Task) {
    const task_name = task_type_to_name(task.task_type);

    this._db.prepare(
      `UPDATE tasks SET ${task_name}='${S_FINISHED}' WHERE start=${task.start} AND end=${task.end}`,
    );
    //TODO: mark entries as redundant if applicable
  }

  public get_task(task_type: TaskType) {
    const task_name = task_type_to_name(task_type);
    //const res = this._db.prepare(`SELECT start, end FROM tasks WHERE ${task_name} = ${S_UNSYNCED} LIMIT 1`).all()

    // If both hybrid(exh/normal) and exclusive(all) modes are used then there might be redundant requests made
    //  TODO: fix ^

    //atomically fetch and update

    const res = this._db.prepare(`
      UPDATE tasks SET ${task_name}='${S_SYNCING}' 
      WHERE task_id = (
        SELECT min(t.task_id)
        FROM tasks t
        where t.${task_name}='${S_UNSYNCED}'
      )
       RETURNING start, end`).all();
    //TODO: add logic for  completion check
    //if length 0 then there are probably no avail tasks
    if (res.length === 0) {
      return null;
    }
    //assert(res.length > 0)
    const task_v = res[0];
    return new Task(task_v["start"], task_v["end"], task_type);
  }

  //this shouldnt ever be anything that isnt the default value
  public get_queries(max_n_gids: number = 25) {
    const query = this._db.prepare(
      `SELECT gid, token FROM api_query WHERE status = '${S_UNSYNCED}' LIMIT ${max_n_gids}`,
    ).all();
    const res = [];
    for (const elem of query) {
      //TODO: check that this thing actually pushes 1 array element instead of 2 separate elements
      res.push([elem["gid"], elem["token"]]);
    }
    return res;
  }
  public add_page_entry(entry: ParsedEntry) {
    this._db.prepare(
      "INSERT OR IGNORE INTO api_query (gid, token, status) VALUES (?, ?, ?)",
    )
      .run(entry.gid, entry.token, S_UNSYNCED);
  }
  public resolve_task(task: Task) {
    const task_name = task_type_to_name(task.task_type);
    this._db.prepare(
      `UPDATE tasks SET ${task_name}='${S_FINISHED}' WHERE ${task_name}='${S_SYNCING}' AND start= (?) AND end=(?)`,
    )
      .run(task.start, task.end);
  }
  public resolve_query(gid: number) {
    this._db.prepare(
      `UPDATE api_query SET status='${S_FINISHED}' WHERE status='${S_SYNCING}' AND gid = (?)`,
    ).run(gid);
  }
  public unresolve_query(gid: number) {
    this._db.prepare(
      `UPDATE api_query SET status='${S_UNSYNCED}' WHERE gid = (?)`,
    ).run(gid);
  }
}

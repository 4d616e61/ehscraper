import { assert } from "@std/assert/assert";
import { DOMParser } from "@b-fuze/deno-dom";

export interface ParsedEntry {
  gid: number;
  token: string;
  tags_solid: string[];
  tags_dashed: string[];
}

export interface ParsedPage {
  entries: ParsedEntry[];
  prev: number;
  next: number;
}

export function parse_page(page: string): ParsedPage {
  const doc = new DOMParser().parseFromString(page, "text/html");
  const entries_table = doc.querySelector(".itg")?.children[0].children;

  assert(entries_table != undefined);
  const entries: ParsedEntry[] = [];
  for (const entry of entries_table) {
    const heuristic_attr = entry.children[0].getAttribute("class");
    //theres like a middle spacing thing here that fucks with this
    if (heuristic_attr === "itd") {
      continue;
    }
    const entry_info = entry.children[1].children[0];

    const href_elem = entry_info.children[1];

    const href_url = href_elem.getAttribute("href");
    //match gallery url id/token
    const href_match = href_url?.match("\/g\/([0-9]+)\/([0-9a-f]+)\/");
    assert(href_match != null && href_match.length === 3);

    const gid: number = +href_match[1];
    const token: string = href_match[2];
    //console.log(href_url)
    //i hate this even more
    const table_start_div = href_elem.children[0].children[1];
    //edge case of no tags
    const tags_table = table_start_div.children.length === 0
      ? []
      : table_start_div.children[0].children[0].children;
    const tags_solid: string[] = [];
    const tags_dashed: string[] = [];
    //holy shit i hate this
    for (const tags_namespaces of tags_table) {
      for (const tags_elem of tags_namespaces.children[1].children) {
        const strength = tags_elem.getAttribute("class");
        const val = tags_elem.getAttribute("title");

        assert(val != null);
        assert(strength === "gtl" || strength === "gt");

        if (strength === "gtl") {
          tags_dashed.push(val);
        } else {
          tags_solid.push(val);
        }
      }
    }
    entries.push({ gid, token, tags_solid, tags_dashed });
  }
  const searchnav = doc.querySelector(".searchnav");
  const prev_url = searchnav?.children[2].children[0].getAttribute("href");
  let prev = -1, next = -1;
  //match prev/next urls
  if (prev_url != null) {
    const prev_match = prev_url.match("prev=([0-9]+)");
    assert(prev_match != null && prev_match.length === 2);
    prev = +prev_match[2];
  }

  const next_url = searchnav?.children[4].children[0].getAttribute("href");
  if (next_url != null) {
    const next_match = next_url.match("next=([0-9]+)");
    assert(next_match != null && next_match.length === 2);
    next = +next_match[1];
  }

  return { entries, prev, next };
}

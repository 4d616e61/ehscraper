import { assertEquals } from "@std/assert";
import { add } from "./main.ts";
import { SyncDB } from "./sync/db.ts"
Deno.test(function addTest() {
  
  assertEquals(add(2, 3), 5);
});

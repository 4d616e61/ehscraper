export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function sleep_await(ms: number) {
  await sleep(ms);
}

export function get_ts() {
  return Date.now();
}

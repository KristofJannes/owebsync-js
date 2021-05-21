import { AssertionFailed } from "../errors";
import { base64 } from "./base64";

export function now(): string {
  const timestamp = base64(
    Math.floor((performance.timeOrigin + performance.now()) * 1000)
  ).padStart(9, "-");
  if (timestamp.length !== 9) {
    throw AssertionFailed;
  }
  return timestamp;
}

export async function generateTag(): Promise<string> {
  let id = now();
  const buf = new Uint8Array(13);
  crypto.getRandomValues(buf);
  for (const b of buf) {
    const b1 = base64(b);
    id += b1[b1.length - 1];
  }
  if (id.length !== 22) {
    throw AssertionFailed;
  }
  return id;
}

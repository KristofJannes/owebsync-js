import { base64 } from "./base64";

// prettier-ignore
const S = new Uint8Array([7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21]);
const T: Uint32Array = new Uint32Array(64);
for (let i = 0; i < 64; i++) {
  T[i] = (2 ** 32 * Math.abs(Math.sin(i + 1))) >>> 0;
}
const A = 0x67452301;
const B = 0xefcdab89;
const C = 0x98badcfe;
const D = 0x10325476;

export function md5(buf: Uint8Array): string {
  const paddingNeeded: number = ((64 - ((buf.length + 9) % 64)) % 64) + 9; // pad to 64 bytes
  const padded: Uint8Array = new Uint8Array(buf.length + paddingNeeded);
  const buffer: Uint32Array = new Uint32Array(padded.buffer);

  padded.set(buf, 0);
  padded[buf.length] = 0x80;

  const l0: number = buf.length * 8;
  const l1: number = Math.floor(l0 / 2 ** 32);
  const l2: number = l0 - l1 * 2 ** 32;
  buffer[buffer.length - 1] = l1;
  buffer[buffer.length - 2] = l2;

  let a: number = A;
  let b: number = B;
  let c: number = C;
  let d: number = D;

  for (let i = 0; i < buffer.length; i += 16) {
    let a1: number = a;
    let b1: number = b;
    let c1: number = c;
    let d1: number = d;

    for (let j = 0; j < 64; j++) {
      const r: number = j >> 4;
      let f = 0;
      let n = 0;
      switch (r) {
        case 0:
          f = d1 ^ (b1 & (c1 ^ d1));
          n = j;
          break;
        case 1:
          f = c1 ^ (d1 & (b1 ^ c1));
          n = (j * 5 + 1) & 0x0f;
          break;
        case 2:
          f = b1 ^ c1 ^ d1;
          n = (j * 3 + 5) & 0x0f;
          break;
        case 3:
          f = c1 ^ (b1 | ~d1);
          n = (j * 7) & 0x0f;
          break;
      }

      const sa: number = S[(r << 2) | (j & 3)];
      a1 += (((f + buffer[i + n]) >>> 0) + T[j]) >>> 0;
      a1 = (((a1 << sa) | (a1 >>> (32 - sa))) + b1) >>> 0;
      const tmp: number = d1;
      d1 = c1;
      c1 = b1;
      b1 = a1;
      a1 = tmp;
    }
    a += a1;
    b += b1;
    c += c1;
    d += d1;
  }

  const response: Uint32Array = new Uint32Array(4);
  response[0] = a;
  response[1] = b;
  response[2] = c;
  response[3] = d;

  let hash = "";
  for (const b of response) {
    hash += base64(b).padStart(6, "0");
  }
  return hash;
}

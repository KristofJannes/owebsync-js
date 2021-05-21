export function utf8Write(str: string): Uint8Array {
  let p = 0;
  let c1: number;
  let c2: number;
  const out: number[] = [];
  for (let i = 0; i < str.length; ++i) {
    c1 = str.charCodeAt(i);
    if (c1 < 128) {
      out[p++] = c1;
    } else if (c1 < 2048) {
      out[p++] = (c1 >> 6) | 192;
      out[p++] = (c1 & 63) | 128;
    } else if (
      (c1 & 0xfc00) === 0xd800 &&
      ((c2 = str.charCodeAt(i + 1)) & 0xfc00) === 0xdc00
    ) {
      c1 = 0x10000 + ((c1 & 0x03ff) << 10) + (c2 & 0x03ff);
      ++i;
      out[p++] = (c1 >> 18) | 240;
      out[p++] = ((c1 >> 12) & 63) | 128;
      out[p++] = ((c1 >> 6) & 63) | 128;
      out[p++] = (c1 & 63) | 128;
    } else {
      out[p++] = (c1 >> 12) | 224;
      out[p++] = ((c1 >> 6) & 63) | 128;
      out[p++] = (c1 & 63) | 128;
    }
  }
  return new Uint8Array(out);
}

export function utf8Read(buf: Uint8Array): string {
  let p = 0;
  let parts: string[] | null = null;
  const chunk: number[] = [];
  let i = 0;
  let t: number;
  while (p < buf.byteLength) {
    t = buf[p++];
    if (t < 128) chunk[i++] = t;
    else if (t > 191 && t < 224) chunk[i++] = ((t & 31) << 6) | (buf[p++] & 63);
    else if (t > 239 && t < 365) {
      t =
        (((t & 7) << 18) |
          ((buf[p++] & 63) << 12) |
          ((buf[p++] & 63) << 6) |
          (buf[p++] & 63)) -
        0x10000;
      chunk[i++] = 0xd800 + (t >> 10);
      chunk[i++] = 0xdc00 + (t & 1023);
    } else
      chunk[i++] = ((t & 15) << 12) | ((buf[p++] & 63) << 6) | (buf[p++] & 63);
    if (i > 8191) {
      (parts || (parts = [])).push(String.fromCharCode(...chunk));
      i = 0;
    }
  }
  if (parts) {
    if (i) {
      parts.push(String.fromCharCode(...chunk.slice(0, i)));
    }
    return parts.join("");
  }
  return String.fromCharCode(...chunk.slice(0, i));
}

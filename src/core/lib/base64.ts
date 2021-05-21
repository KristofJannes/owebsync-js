const ORDER_PRESERVING_BASE64_CHARSET =
  "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";

export function base64(i: number): string {
  if (i === 0) {
    return "-";
  }
  let s: string[] = [];
  while (i > 0) {
    s.unshift(ORDER_PRESERVING_BASE64_CHARSET[i % 64]);
    i = Math.floor(i / 64);
  }
  return s.join("");
}

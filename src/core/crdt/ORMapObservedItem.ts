import { Uint8ArrayReader, Uint8ArrayWriter } from "../lib/encoding";

export class ObservedItem {
  public readonly _key: string;
  public readonly _tag: string;
  public _hash: string;

  public constructor(key: string, tag: string, hash: string) {
    this._key = key;
    this._tag = tag;
    this._hash = hash;
  }

  public _encode(w: Uint8ArrayWriter) {
    w._writeString(this._key);
    w._writeString(this._tag);
    w._writeString(this._hash);
  }

  public static _decode(r: Uint8ArrayReader): ObservedItem {
    const key = r._readString();
    const tag = r._readString();
    const hash = r._readString();
    return new ObservedItem(key, tag, hash);
  }
}

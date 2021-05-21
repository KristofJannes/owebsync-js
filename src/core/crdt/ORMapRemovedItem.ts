import { Uint8ArrayReader, Uint8ArrayWriter } from "../lib/encoding";

export class RemovedItem {
  public readonly _tag: string;
  public readonly _timestamp: string;

  constructor(tag: string, timestamp: string) {
    this._tag = tag;
    this._timestamp = timestamp;
  }

  public _encode(w: Uint8ArrayWriter) {
    w._writeString(this._tag);
    w._writeString(this._timestamp);
  }

  public static _decode(r: Uint8ArrayReader): RemovedItem {
    const tag = r._readString();
    const timestamp = r._readString();
    return new RemovedItem(tag, timestamp);
  }
}

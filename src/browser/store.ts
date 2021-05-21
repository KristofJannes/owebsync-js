import { del, get, set } from "idb-keyval";
import { IStore } from "../core/store";

export class IDBStore implements IStore {
  public async _get(tag: string): Promise<Uint8Array> {
    return (await get<Uint8Array>(tag))!;
  }
  public async _set(tag: string, buf: Uint8Array): Promise<void> {
    await set(tag, buf);
  }
  public async _del(tag: string): Promise<void> {
    del(tag);
  }
}

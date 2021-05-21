import leveldown from "leveldown";
import levelup from "levelup";
import { LevelUp } from "levelup";
import { IStore } from "../core/store";

/**
 * An IStore implementation using leveldb as storage backend.
 */
export class LevelDBStore implements IStore {
  private _db: LevelUp;

  public constructor() {
    this._db = levelup(leveldown("./db"));
  }

  public async _get(tag: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await this._db.get(tag));
    } catch (err: any) {
      if (err.notFound) {
        return null;
      }
      throw err;
    }
  }

  public async _set(tag: string, buf: Uint8Array): Promise<void> {
    await this._db.put(tag, Buffer.from(buf));
  }

  public async _del(tag: string): Promise<void> {
    await this._db.del(tag);
  }
}

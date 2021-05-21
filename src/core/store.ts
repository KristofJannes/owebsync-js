import { CRDTImpl } from "./crdt/crdt";
import { synchronized } from "./lib/concurrency";
import { Uint8ArrayReader } from "./lib/encoding";

export declare class IStore {
  _get(tag: string): Promise<Uint8Array | null>;
  _set(tag: string, buf: Uint8Array): Promise<void>;
  _del(tag: string): Promise<void>;
}

/**
 * Stores all CRDTs in the given IStore K/V-store.
 * This class adds caching functionality, as well as locking, to any IStore
 *  implementation.
 */
export class Store {
  private readonly _store: IStore;

  private readonly _cache: Map<string, CRDTImpl> = new Map();

  public constructor(store: IStore) {
    this._store = store;
  }

  @synchronized
  public async _get(
    path: string,
    parent: CRDTImpl,
    tag: string
  ): Promise<CRDTImpl | null> {
    if (this._cache.has(tag)) {
      return this._cache.get(tag)!;
    }
    const buf: Uint8Array | null = await this._store._get(tag);
    if (buf == null) {
      return null;
    }
    const crdt = CRDTImpl._decodeImpl(
      new Uint8ArrayReader(buf),
      this,
      path,
      parent
    );
    this._cache.set(tag, crdt);
    return crdt;
  }

  @synchronized
  public async _set(tag: string, crdt: CRDTImpl): Promise<void> {
    if (!this._cache.has(tag)) {
      this._cache.set(tag, crdt);
    }
    const buf: Uint8Array = crdt._encode()._uint8array();
    await this._store._set(tag, buf);
  }

  @synchronized
  public async _del(tag: string): Promise<void> {
    this._cache.delete(tag);
    await this._store._del(tag);
  }
}

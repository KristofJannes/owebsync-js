import { Store } from "../store";
import { Uint8ArrayReader, Uint8ArrayWriter } from "../lib/encoding";
import { md5 } from "../lib/md5";
import { SortedArray } from "../lib/sortedArray";
import { generateTag, now } from "../lib/uuid";
import { CRDT, CRDTImpl, CRDTKind, isRegisterValue } from "./crdt";
import {
  ChildrenMessage,
  GetMessage,
  isPushMessage,
  Message,
  PushMessage,
} from "../network/messages";
import { AssertionFailed } from "../errors";
import { RemovedItem } from "./ORMapRemovedItem";
import { ObservedItem } from "./ORMapObservedItem";

export class ORMap extends CRDT {
  public readonly _observed: SortedArray<"_key", ObservedItem>;
  public readonly _removed: SortedArray<"_tag", RemovedItem>;

  public constructor(
    tag: string,
    hash: string,
    observed: SortedArray<"_key", ObservedItem>,
    removed: SortedArray<"_tag", RemovedItem>
  ) {
    super(CRDTKind.ORMap, tag, hash);
    this._observed = observed;
    this._removed = removed;
  }
}

export class ORMapImpl extends CRDTImpl implements ORMap {
  public readonly _observed: SortedArray<"_key", ObservedItem>;
  public readonly _removed: SortedArray<"_tag", RemovedItem>;

  public constructor(
    tag: string,
    hash: string,
    observed: SortedArray<"_key", ObservedItem>,
    removed: SortedArray<"_tag", RemovedItem>,
    store: Store,
    path: string,
    parent: CRDTImpl
  ) {
    super(CRDTKind.ORMap, tag, hash, store, path, parent);
    this._observed = observed;
    this._removed = removed;
  }

  public _encode(
    writer: Uint8ArrayWriter = new Uint8ArrayWriter()
  ): Uint8ArrayWriter {
    super._encode(writer);
    writer._writeVarInt(this._observed.length);
    for (const o of this._observed) {
      o._encode(writer);
    }
    writer._writeVarInt(this._removed.length);
    for (const r of this._removed) {
      r._encode(writer);
    }
    return writer;
  }

  public async _get(path: string[]): Promise<unknown> {
    if (path.length === 0) {
      const obj: Record<string, unknown> = {};
      await Promise.all(
        this._observed.map(async (o: ObservedItem) => {
          const child: CRDTImpl = await this._getObservedFromStore(o);
          obj[o._key] = await child._get([]);
        })
      );
      return obj;
    } else {
      const o: ObservedItem | null = this._observed._get(path[0]);
      if (o == null) {
        return undefined;
      }
      const child: CRDTImpl = await this._getObservedFromStore(o);
      return child._get(path.slice(1));
    }
  }

  public async _set(value: unknown, path: string[]): Promise<CRDTImpl> {
    if (path.length === 0) {
      if (isRegisterValue(value)) {
        if (this._parent == null) {
          throw "root node can only be an ORMap";
        }
        const newThis: CRDTImpl = await this._convertToLWWRegister();
        return newThis._set(value, path);
      } else {
        await Promise.all(
          Object.entries(value as Record<string, unknown>).map(
            async ([key, childValue]: [string, unknown]) => {
              let o: ObservedItem | null = this._observed._get(key);
              if (o == null) {
                const child: CRDTImpl = await CRDTImpl._newImpl(
                  this._store,
                  `${this._path}.${key}`,
                  isRegisterValue(childValue)
                    ? CRDTKind.LWWRegister
                    : CRDTKind.ORMap,
                  this
                );
                await child._save();
                o = new ObservedItem(key, child._tag, child._hash);
              }
              let child: CRDTImpl = await this._getObservedFromStore(o);
              child = await child._set(childValue, []);
              this._observed._upsert(
                new ObservedItem(key, child._tag, child._hash)
              );
            }
          )
        );
      }
    } else {
      let o: ObservedItem | null = this._observed._get(path[0]);
      if (o == null) {
        const child: CRDTImpl = await CRDTImpl._newImpl(
          this._store,
          `${this._path}.${path[0]}`,
          path.length === 1 && isRegisterValue(value)
            ? CRDTKind.LWWRegister
            : CRDTKind.ORMap,
          this
        );
        await child._save();
        o = new ObservedItem(path[0], child._tag, child._hash);
      }
      let child: CRDTImpl = await this._getObservedFromStore(o);
      child = await child._set(value, path.slice(1));
      this._observed._upsert(
        new ObservedItem(path[0], child._tag, child._hash)
      );
    }
    await this._save();
    return this;
  }

  public async _del(path: string[]): Promise<void> {
    if (path.length === 0) {
      for (const o of this._observed) {
        const child: CRDTImpl = await this._getObservedFromStore(o);
        await child._del([]);
      }
      if (this._parent == null) {
        throw "Cannot remove the root node";
      }
      await this._parent._delTag(this._tag);
      await this._store._del(this._tag);
    } else {
      const o: ObservedItem | null = this._observed._get(path[0]);
      if (o != null) {
        const child: CRDTImpl = await this._getObservedFromStore(o);
        await child._del(path.slice(1));
        o._hash = child._hash;
        await this._save();
      }
    }
  }

  public async _delTag(tag: string): Promise<void> {
    const o: ObservedItem | undefined = this._observed.find(
      (o) => o._tag === tag
    );
    if (o != null) {
      this._observed._delete(o._key);
      this._removed._upsert(new RemovedItem(tag, now()));
      await this._save();
    }
  }

  protected async _handleChildrenMsg(
    msg: ChildrenMessage
  ): Promise<ChildrenMessage | null> {
    if (this._tag === msg._tag) {
      let updated = false;

      // process removed children
      await Promise.all(
        msg._removed.map(async (r: RemovedItem) => {
          const o: ObservedItem | undefined = this._observed.find(
            (o) => o._tag === r._tag
          );
          if (o != null) {
            const child: CRDTImpl = await this._getObservedFromStore(o);
            child._del([]);
            this._observed._delete(child._tag);
          }
          this._removed._upsert(new RemovedItem(r._tag, r._timestamp));
          updated = true;
        })
      );

      // process observed children
      const response = new ChildrenMessage(this._tag, [], {});
      await Promise.all(
        Object.entries(msg._children).map(
          async ([key, childMsg]: [string, Message]) => {
            let o: ObservedItem | null = this._observed._get(key);
            if (o == null) {
              if (isPushMessage(childMsg)) {
                const crdt: CRDT = CRDTImpl._decode(
                  new Uint8ArrayReader(childMsg._crdt)
                );
                const child: CRDTImpl = await CRDTImpl._newImplFromCRDT(
                  this._store,
                  `${this._path}.${key}`,
                  this,
                  crdt
                );
                await child._save();
                o = new ObservedItem(key, child._tag, child._hash);
                this._observed._upsert(o);
                updated = true;
              } else {
                throw AssertionFailed;
              }
            }
            const child: CRDTImpl = await this._getObservedFromStore(o);
            const childResponse = await child._handleMessage(childMsg);
            if (childResponse != null) {
              response._children[key] = childResponse;
            }
            if (o._hash !== child._hash) {
              o._hash = child._hash;
              updated = true;
            }
          }
        )
      );
      if (updated) {
        await this._save();
      }
      if (Object.keys(response._children).length > 0) {
        return response;
      }
    }
    return null;
  }

  public async _merge(remote: ORMap): Promise<ChildrenMessage | null> {
    let updated = false;
    let response = new ChildrenMessage(this._tag, [], {});

    // find out which removed items the remote side does not have yet
    for (const r1 of this._removed) {
      if (!remote._removed._has(r1._tag)) {
        response._removed.push(r1);
      }
    }

    // find out which removed items the local side does not have yet
    for (const r2 of remote._removed) {
      if (!this._removed._has(r2._tag)) {
        const o1 = this._observed.find((o1) => o1._tag === r2._tag);
        if (o1 != null) {
          await this._delTag(o1._tag);
        }
        this._removed._upsert(r2);
        updated = true;
      }
    }

    // find out which observed items are missing on either side
    let i1 = 0;
    let i2 = 0;
    while (i1 < this._observed.length && i2 < remote._observed.length) {
      const o1: ObservedItem = this._observed[i1];
      const o2: ObservedItem = remote._observed[i2];
      if (o1._key < o2._key) {
        if (!remote._removed._has(o1._tag)) {
          // remote has not yet observed o1, send it
          response._children[o1._key] = new PushMessage(
            (await this._getObservedFromStore(o1))._encode()._uint8array()
          );
        }
        i1++;
        continue;
      } else if (o1._key === o2._key) {
        if (o1._tag === o2._tag) {
          if (o1._hash !== o2._hash) {
            // the subtree o1 has changed on some side, send it
            response._children[o1._key] = new PushMessage(
              (await this._getObservedFromStore(o1))._encode()._uint8array()
            );
          }
        } else if (o1._tag > o2._tag) {
          // conflicting tags on both side
          // remote has the oldest tag, so remove the local one and ask for the remote one
          await this._del([o1._key]);
          response._children[o2._key] = new GetMessage("");
        } else if (o1._tag < o2._tag) {
          // conflicting tags on both side
          // local has the oldest tag, so remove the remote one and send the local one
          const r1 = new RemovedItem(o2._tag, now());
          response._removed.push(r1);
          this._removed._upsert(r1);
          response._children[o1._key] = new PushMessage(
            (await this._getObservedFromStore(o1))._encode()._uint8array()
          );
        }
        i1++;
        i2++;
        continue;
      } else if (o1._key > o2._key) {
        // local has not yet observed o2, ask for it
        if (!this._removed._has(o2._tag)) {
          response._children[o2._key] = new GetMessage("");
        }
        i2++;
        continue;
      }
    }
    while (i1 < this._observed.length) {
      const o1 = this._observed[i1];
      if (!remote._removed._has(o1._tag)) {
        // remote has not yet observed o1, send it
        response._children[o1._key] = new PushMessage(
          (await this._getObservedFromStore(o1))._encode()._uint8array()
        );
      }
      i1++;
    }
    while (i2 < remote._observed.length) {
      const o2 = remote._observed[i2];
      if (!this._removed._has(o2._tag)) {
        // local has not yet observed o2, ask for it
        response._children[o2._key] = new GetMessage("");
      }
      i2++;
    }

    if (updated) {
      await this._save();
    }

    if (
      response._removed.length !== 0 ||
      Object.keys(response._children).length !== 0
    ) {
      return response;
    }
    return null;
  }

  public async _replace(tag: string, child: CRDTImpl): Promise<void> {
    const o: ObservedItem | undefined = this._observed.find(
      (o) => o._tag === tag
    );
    if (o == null) {
      throw AssertionFailed;
    }
    this._delTag(tag);
    this._observed._upsert(new ObservedItem(o._key, child._tag, child._hash));
    await this._save();
  }

  public _updateHash(): void {
    const w = new Uint8ArrayWriter();
    for (const o of this._observed) {
      w._writeString(o._tag);
      w._writeString(o._hash);
    }
    for (const r of this._removed) {
      w._writeString(r._tag);
    }
    const buf: Uint8Array = w._uint8array();
    this._hash = md5(buf);
  }

  private async _getObservedFromStore(o: ObservedItem): Promise<CRDTImpl> {
    return (await this._store._get(`${this._path}.${o._key}`, this, o._tag))!;
  }

  private async _convertToLWWRegister(): Promise<CRDTImpl> {
    const newThis: CRDTImpl = await CRDTImpl._newImpl(
      this._store,
      this._path,
      CRDTKind.LWWRegister,
      this._parent
    );
    await this._parent._replace(this._tag, newThis);
    return newThis;
  }
}

CRDTImpl._newImplMap.set(
  CRDTKind.ORMap,
  async (
    store: Store,
    path: string,
    parent: CRDTImpl,
    tag?: string
  ): Promise<CRDTImpl> => {
    const crdt = new ORMapImpl(
      tag || (await generateTag()),
      "",
      new SortedArray("_key"),
      new SortedArray("_tag"),
      store,
      path,
      parent
    );
    crdt._updateHash();
    return crdt;
  }
);

CRDTImpl._newImplFromCRDTMap.set(
  CRDTKind.ORMap,
  async (
    store: Store,
    path: string,
    parent: CRDTImpl,
    crdt: CRDT
  ): Promise<ORMapImpl> => {
    if (crdt instanceof ORMap) {
      const newCrdt = new ORMapImpl(
        crdt._tag,
        "",
        new SortedArray("_key"),
        new SortedArray("_tag"),
        store,
        path,
        parent
      );
      newCrdt._updateHash();
      return newCrdt;
    }
    throw AssertionFailed;
  }
);

CRDTImpl._decodeMap.set(CRDTKind.ORMap, (reader: Uint8ArrayReader): ORMap => {
  const tag = reader._readString();
  const hash = reader._readString();
  const observedLength = reader._readVarInt();
  const observed: SortedArray<"_key", ObservedItem> = new SortedArray("_key");
  for (let i = 0; i < observedLength; i++) {
    observed._upsert(ObservedItem._decode(reader));
  }
  const removedLength = reader._readVarInt();
  const removed: SortedArray<"_tag", RemovedItem> = new SortedArray("_tag");
  for (let i = 0; i < removedLength; i++) {
    removed._upsert(RemovedItem._decode(reader));
  }
  return new ORMap(tag, hash, observed, removed);
});

CRDTImpl._decodeImplMap.set(
  CRDTKind.ORMap,
  (crdt: unknown, store: Store, path: string, parent: CRDTImpl): ORMapImpl => {
    if (crdt instanceof ORMap) {
      return new ORMapImpl(
        crdt._tag,
        crdt._hash,
        crdt._observed,
        crdt._removed,
        store,
        path,
        parent
      );
    }
    throw AssertionFailed;
  }
);

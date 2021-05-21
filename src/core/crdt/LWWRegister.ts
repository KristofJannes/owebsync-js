import { Store } from "../store";
import { Uint8ArrayReader, Uint8ArrayWriter } from "../lib/encoding";
import { md5 } from "../lib/md5";
import { generateTag, now } from "../lib/uuid";
import { CRDT, CRDTImpl, CRDTKind, isRegisterValue } from "./crdt";
import { ChildrenMessage, PushMessage } from "../network/messages";
import { AssertionFailed } from "../errors";

export class LWWRegister extends CRDT {
  public _timestamp: string;
  public _value: string;

  public constructor(
    tag: string,
    hash: string,
    timestamp: string,
    value: string
  ) {
    super(CRDTKind.LWWRegister, tag, hash);
    this._timestamp = timestamp;
    this._value = value;
  }
}

export class LWWRegisterImpl extends CRDTImpl implements LWWRegister {
  public _timestamp: string;
  public _value: string;

  public constructor(
    tag: string,
    hash: string,
    timestamp: string,
    value: string,
    store: Store,
    path: string,
    parent: CRDTImpl
  ) {
    super(CRDTKind.LWWRegister, tag, hash, store, path, parent);
    this._timestamp = timestamp;
    this._value = value;
  }

  public _encode(
    writer: Uint8ArrayWriter = new Uint8ArrayWriter()
  ): Uint8ArrayWriter {
    super._encode(writer);
    writer._writeString(this._timestamp);
    writer._writeString(this._value);
    return writer;
  }

  public async _get(path: string[]): Promise<unknown> {
    if (path.length === 0) {
      return JSON.parse(this._value);
    } else {
      return undefined;
    }
  }

  public async _set(value: unknown, path: string[]): Promise<CRDTImpl> {
    if (path.length === 0 && isRegisterValue(value)) {
      if (this._value !== JSON.stringify(value)) {
        this._timestamp = now();
        this._value = JSON.stringify(value);
        await this._save();
      }
      return this;
    } else {
      const newThis: CRDTImpl = await this._convertToORMap();
      return newThis._set(value, path);
    }
  }

  public async _del(path: string[]): Promise<void> {
    if (path.length === 0) {
      await this._parent._delTag(this._tag);
      await this._store._del(this._tag);
    }
  }

  public async _delTag(): Promise<void> {
    throw AssertionFailed; // LWWRegister does not have children
  }

  protected async _handleChildrenMsg(_msg: ChildrenMessage): Promise<null> {
    return null; // LWWRegister does not have children
  }

  protected async _merge(remote: LWWRegister): Promise<PushMessage | null> {
    if (
      remote._timestamp > this._timestamp ||
      (remote._timestamp === this._timestamp && remote._hash > this._hash)
    ) {
      this._value = remote._value;
      this._timestamp = remote._timestamp;
      await this._save();
      return null;
    }
    if (
      remote._value !== this._value ||
      remote._timestamp !== this._timestamp
    ) {
      return new PushMessage(this._encode()._uint8array());
    }
    return null;
  }

  public _replace(): Promise<void> {
    throw AssertionFailed; // LWWRegister does not have children
  }

  public _updateHash(): void {
    const w = new Uint8ArrayWriter();
    w._writeString(this._timestamp);
    w._writeString(this._value);
    const buf: Uint8Array = w._uint8array();
    this._hash = md5(buf);
  }

  /**
   * Replace this LWWRegister with an ORMap.
   */
  private async _convertToORMap(): Promise<CRDTImpl> {
    const newThis: CRDTImpl = await CRDTImpl._newImpl(
      this._store,
      this._path,
      CRDTKind.ORMap,
      this._parent
    );
    await this._parent._replace(this._tag, newThis);
    return newThis;
  }
}

CRDTImpl._newImplMap.set(
  CRDTKind.LWWRegister,
  async (
    store: Store,
    path: string,
    parent: CRDTImpl,
    tag?: string
  ): Promise<LWWRegisterImpl> => {
    const crdt = new LWWRegisterImpl(
      tag || (await generateTag()),
      "",
      now(),
      JSON.stringify(null),
      store,
      path,
      parent
    );
    crdt._updateHash();
    return crdt;
  }
);

CRDTImpl._newImplFromCRDTMap.set(
  CRDTKind.LWWRegister,
  async (
    store: Store,
    path: string,
    parent: CRDTImpl,
    crdt: CRDT
  ): Promise<LWWRegisterImpl> => {
    if (crdt instanceof LWWRegister) {
      const newCrdt = new LWWRegisterImpl(
        crdt._tag,
        crdt._hash,
        crdt._timestamp,
        crdt._value,
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

CRDTImpl._decodeMap.set(
  CRDTKind.LWWRegister,
  (reader: Uint8ArrayReader): LWWRegister => {
    const tag = reader._readString();
    const hash = reader._readString();
    const timestamp = reader._readString();
    const value = reader._readString();
    return new LWWRegister(tag, hash, timestamp, value);
  }
);

CRDTImpl._decodeImplMap.set(
  CRDTKind.LWWRegister,
  (
    crdt: unknown,
    store: Store,
    path: string,
    parent: CRDTImpl
  ): LWWRegisterImpl => {
    if (crdt instanceof LWWRegister) {
      return new LWWRegisterImpl(
        crdt._tag,
        crdt._hash,
        crdt._timestamp,
        crdt._value,
        store,
        path,
        parent
      );
    }
    throw AssertionFailed;
  }
);

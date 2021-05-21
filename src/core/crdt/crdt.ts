import { Store } from "../store";
import {
  ChildrenMessage,
  GetMessage,
  isChildrenMessage,
  isGetMessage,
  isPushMessage,
  Message,
  PushMessage,
} from "../network/messages";
import { Uint8ArrayReader, Uint8ArrayWriter } from "../lib/encoding";

export const enum CRDTKind {
  LWWRegister = 1,
  ORMap = 2,
}

/**
 * Abstract class representing a CRDT and its metadata.
 * Instances of CRDT contain all data that is send over the network or stored on disc.
 */
export abstract class CRDT {
  public readonly _kind: CRDTKind;
  public readonly _tag: string;
  public _hash: string;

  protected constructor(kind: CRDTKind, tag: string, hash: string) {
    this._kind = kind;
    this._tag = tag;
    this._hash = hash;
  }
}

/**
 * Abstract class representing a CRDT and its behavior.
 */
export abstract class CRDTImpl extends CRDT {
  protected _store: Store;
  protected _path: string;
  protected _parent: CRDTImpl;

  public static _onChanged: (path: string) => void;

  protected constructor(
    kind: CRDTKind,
    tag: string,
    hash: string,
    store: Store,
    path: string,
    parent: CRDTImpl
  ) {
    super(kind, tag, hash);
    this._store = store;
    this._path = path;
    this._parent = parent;
  }

  /**
   * Encode a CRDT to bytes.
   */
  public _encode(
    writer: Uint8ArrayWriter = new Uint8ArrayWriter()
  ): Uint8ArrayWriter {
    writer._writeByte(this._kind);
    writer._writeString(this._tag);
    writer._writeString(this._hash);
    return writer;
  }

  /**
   * Retrieve the JSON object at the given path.
   */
  public abstract _get(path: string[]): Promise<unknown>;

  /**
   * Set the given JSON object at the given path.
   */
  public abstract _set(value: unknown, path: string[]): Promise<CRDTImpl>;

  /**
   * Delete the JSON object at the given path.
   */
  public abstract _del(path: string[]): Promise<void>;

  /**
   * Delete the child object with the given tag.
   */
  public abstract _delTag(tag: string): Promise<void>;

  /**
   * Handle the given message from another peer.
   */
  public async _handleMessage(
    msg: Message
  ): Promise<PushMessage | ChildrenMessage | null> {
    if (isGetMessage(msg)) {
      return await this._handleGetMessage(msg);
    }
    if (isPushMessage(msg)) {
      return await this._handlePushMessage(msg);
    }
    if (isChildrenMessage(msg)) {
      return await this._handleChildrenMsg(msg);
    }
    return null;
  }

  protected async _handleGetMessage(
    msg: GetMessage
  ): Promise<PushMessage | null> {
    if (msg._hash !== this._hash) {
      return new PushMessage(this._encode()._uint8array());
    }
    return null;
  }

  protected async _handlePushMessage(
    msg: PushMessage
  ): Promise<PushMessage | ChildrenMessage | null> {
    const crdt = CRDTImpl._decode(new Uint8ArrayReader(msg._crdt));
    if (this._tag === crdt._tag) {
      return await this._merge(crdt);
    }
    return null;
  }

  protected abstract _handleChildrenMsg(
    _msg: ChildrenMessage
  ): Promise<ChildrenMessage | null>;

  /**
   * Merge the state of the remote CRDT with the local CRDT.
   * Also checks the hashes from the Merkle-tree, to find changes within child CRDTs.
   */
  protected abstract _merge(
    remote: CRDT
  ): Promise<PushMessage | ChildrenMessage | null>;

  /**
   * Replace the child CRDT with the given tag with the given CRDT.
   */
  public abstract _replace(tag: string, child: CRDT): Promise<void>;

  /**
   * Recalculate the hash of this CRDT.
   */
  protected abstract _updateHash(): void;

  public async _save(): Promise<void> {
    this._updateHash();
    await this._store._set(this._tag, this);
    CRDTImpl._onChanged(this._path);
  }

  public static _newImplMap: Map<
    CRDTKind,
    (
      store: Store,
      path: string,
      parent: CRDTImpl,
      tag?: string
    ) => Promise<CRDTImpl>
  > = new Map();
  public static _newImpl(
    store: Store,
    path: string,
    kind: CRDTKind,
    parent: CRDTImpl,
    tag?: string
  ): Promise<CRDTImpl> {
    return this._newImplMap.get(kind)!(store, path, parent, tag);
  }

  public static _newImplFromCRDTMap: Map<
    CRDTKind,
    (
      store: Store,
      path: string,
      parent: CRDTImpl,
      crdt: CRDT
    ) => Promise<CRDTImpl>
  > = new Map();
  public static _newImplFromCRDT(
    store: Store,
    path: string,
    parent: CRDTImpl,
    crdt: CRDT
  ): Promise<CRDTImpl> {
    return this._newImplFromCRDTMap.get(crdt._kind)!(store, path, parent, crdt);
  }

  public static _decodeMap: Map<CRDTKind, (reader: Uint8ArrayReader) => CRDT> =
    new Map();
  public static _decode(reader: Uint8ArrayReader): CRDT {
    return this._decodeMap.get(reader._readByte())!(reader);
  }

  public static _decodeImplMap: Map<
    CRDTKind,
    (crdt: unknown, store: Store, path: string, parent: CRDTImpl) => CRDTImpl
  > = new Map();
  public static _decodeImpl(
    reader: Uint8ArrayReader,
    store: Store,
    path: string,
    parent: CRDTImpl
  ): CRDTImpl {
    const kind: CRDTKind = reader._readByte();
    const crdt: CRDT = this._decodeMap.get(kind)!(reader);
    return this._decodeImplMap.get(kind)!(crdt, store, path, parent);
  }
}

export function isRegisterValue(
  value: unknown
): value is string | number | boolean | null {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value == null
  );
}

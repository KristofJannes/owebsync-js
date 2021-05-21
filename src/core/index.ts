import { CRDTImpl, CRDTKind } from "./crdt/crdt";
import "./crdt/LWWRegister";
import "./crdt/ORMap";
import { generateTag } from "./lib/uuid";
import { GetMessage, Message } from "./network/messages";
import { MsgHandler, Network } from "./network/network";
import { IStore, Store } from "./store";
import type { Json } from "./types";

export interface INetwork extends Partial<Network> {
  _broadcast: (msg: Uint8Array) => void;
  _msgHandler?: MsgHandler;
}

export class OWebSync {
  public _id: string;
  private _store: Store;
  private _network: INetwork;

  private _root!: CRDTImpl;

  private _listeners: Map<string, Set<(o: unknown) => void>> = new Map();

  private constructor(id: string, store: Store, network: INetwork) {
    this._id = id;
    this._store = store;
    this._network = network;
    CRDTImpl._onChanged = async (path: string): Promise<void> => {
      const listeners = this._listeners.get(path);
      if (listeners != null) {
        const value = await this.get(path[0] === "." ? path.slice(1) : path);
        for (const listener of listeners) {
          listener(value);
        }
      }

      if (path === "") {
        this._network._broadcast(
          new GetMessage(this._root._hash)._encode()._uint8array()
        );
      }
    };
  }

  /**
   * Create a new OWebSync instance.
   *
   * This function is used instead of the contructor to be able to be able to
   *  return a Promise.
   */
  public static async _build(
    id: string,
    store: IStore,
    network: INetwork
  ): Promise<OWebSync> {
    const owebsync = new OWebSync(id, new Store(store), network);
    owebsync._root = (await owebsync._store._get("", null as any, "0"))!;
    if (owebsync._root == null) {
      owebsync._root = await CRDTImpl._newImpl(
        owebsync._store,
        "",
        CRDTKind.ORMap,
        null as any,
        "0"
      );
    }
    network._msgHandler = owebsync;
    network._broadcast(
      new GetMessage(owebsync._root._hash)._encode()._uint8array()
    );
    return owebsync;
  }

  /**
   * Retrieve the JSON object at the given path.
   */
  public async get<T extends unknown>(path: string): Promise<T> {
    return (await this._root._get(path === "" ? [] : path.split("."))) as T;
  }

  /**
   * Listen to changes to the JSON object at the given path.
   */
  public async listen(
    path: string,
    callback: (o: unknown) => void
  ): Promise<void> {
    if (path !== "") {
      path = `.${path}`;
    }
    if (!this._listeners.has(path)) {
      this._listeners.set(path, new Set());
    }
    this._listeners.get(path)!.add(callback);

    const value = await this.get(path[0] === "." ? path.slice(1) : path);
    callback(value);
  }

  /**
   * Set the given JSON object at the given path.
   */
  public async set(path: string, value: Json): Promise<void> {
    await this._root._set(value, path.split("."));
  }

  /**
   * Delete the JSON object at the given path.
   */
  public async del(path: string): Promise<void> {
    await this._root._del(path.split("."));
  }

  /**
   * Utility function to get a new unique ID.
   */
  public getUUID(): Promise<string> {
    return generateTag();
  }

  /**
   * Handle the given message from another peer.
   *
   * This is not supposed to be called by a user.
   */
  public async _handleMessage(msg: Message): Promise<Uint8Array | null> {
    return (
      (await this._root._handleMessage(msg))?._encode()._uint8array() ?? null
    );
  }
}

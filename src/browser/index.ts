import { INetwork, OWebSync as OWebSyncImpl } from "../core";
import { Message } from "../core/network/messages";
import { Network } from "../core/network/network";
import { Json, OWebSync as OWebSyncType } from "../core/types";
import { IDBStore } from "./store";
import { WebSocketClient } from "./ws";

var currentScript: string;

if (self.document == null) {
  const network: INetwork = {
    _broadcast: (msg: Uint8Array) => {
      self.postMessage([-1, msg], [msg.buffer]);
    },
  };
  let owebsync: OWebSyncImpl | null = null;

  self.onmessage = async function (ev: MessageEvent) {
    const [i, target, ...args] = ev.data as [number, string, ...any[]];
    switch (target) {
      case "_new": {
        owebsync = await OWebSyncImpl._build(args[0], new IDBStore(), network);
        self.postMessage([i]);
        break;
      }
      case "_get": {
        const result = await owebsync!.get(args[0]);
        self.postMessage([i, result]);
        break;
      }
      case "_listen": {
        const port = args[1] as MessagePort;
        await owebsync!.listen(args[0], (o: unknown) => {
          port.postMessage(o);
        });
        self.postMessage([i]);
        break;
      }
      case "_set": {
        await owebsync!.set(args[0], args[1]);
        self.postMessage([i]);
        break;
      }
      case "_del": {
        await owebsync!.del(args[0]);
        self.postMessage([i]);
        break;
      }
      case "_getUUID": {
        const result = await owebsync!.getUUID();
        self.postMessage([i, result]);
        break;
      }
      case "_handleMessage": {
        const result = await owebsync!._handleMessage(args[0]);
        self.postMessage([i, result]);
        break;
      }
    }
  };
} else {
  currentScript = (document.currentScript as HTMLScriptElement).src;
}

export default async function OWebSync(
  webSocketURL: string,
  options?: {
    noWebRTC?: boolean;
    iceServers?: RTCIceServer[];
  }
): Promise<OWebSyncType> {
  const id = crypto.getRandomValues(new Uint32Array(1))[0].toString();
  const network = new Network(
    id,
    options?.noWebRTC ?? false,
    options?.iceServers
  );

  const worker = new Worker(currentScript);
  let latestSequenceNumber = 0;
  const waitingPromises: Map<number, (...args: any) => void> = new Map();
  worker.onmessage = function (ev: MessageEvent) {
    const [i, response] = ev.data as [number, unknown];
    if (i === -1) {
      network._broadcast(response as Uint8Array);
    } else {
      waitingPromises.get(i)!(response);
      waitingPromises.delete(i);
    }
  };

  function send<T>(
    target: string,
    args: unknown[],
    transfer: Transferable[] = []
  ): Promise<T> {
    return new Promise((resolve) => {
      const i = latestSequenceNumber++;
      worker.postMessage([i, target, ...args], transfer);
      waitingPromises.set(i, resolve);
    });
  }

  await send("_new", [id]);

  const owebsync = {
    get: <T extends unknown>(path: string): Promise<T> => {
      return send("_get", [path]);
    },
    listen: (path: string, callback: (o: unknown) => void): Promise<void> => {
      const channel = new MessageChannel();
      channel.port1.onmessage = function (ev: MessageEvent) {
        callback(ev.data);
      };
      return send("_listen", [path, channel.port2], [channel.port2]);
    },
    set: (path: string, value: Json): Promise<void> => {
      return send("_set", [path, value]);
    },
    del: (path: string): Promise<void> => {
      return send("_del", [path]);
    },
    getUUID: (): Promise<string> => {
      return send("_getUUID", []);
    },
    _handleMessage: async (msg: Message): Promise<Uint8Array | null> => {
      return send("_handleMessage", [msg]);
    },
  };

  network._msgHandler = owebsync;

  const ws = new WebSocketClient(`${webSocketURL}?id=${id}`);
  network._addPeer("", ws);

  return owebsync;
}

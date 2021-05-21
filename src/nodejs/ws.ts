import * as http from "http";
import * as WS from "ws";
import { Network } from "../core/network/network";
import { IPeer } from "../core/network/peer";

export class WebSocketClient implements IPeer {
  public _onMsg!: (msg: Uint8Array) => void;
  public _onOpen!: () => void;
  public _onClose!: () => void;

  private _ws: WebSocket | null = null;

  public constructor(ws: WebSocket) {
    this._ws = ws;

    this._ws.addEventListener("open", (): void => {
      this._onOpen();
    });
    ws.addEventListener("message", async (ev): Promise<void> => {
      const buf = ev.data as Uint8Array;
      this._onMsg(buf);
    });
    this._ws.addEventListener("close", (): void => {
      this._onClose();
    });
  }

  public _send(msg: Uint8Array): void {
    if (this._ws != null && this._ws.readyState === WS.OPEN) {
      this._ws.send(msg);
    }
  }
}

export function startServer(server: http.Server, network: Network) {
  const ws = new WS.Server({
    perMessageDeflate: true,
    server: server,
  });
  ws.on("connection", (ws: WebSocket, request: Request): void => {
    const id = request.url.slice(5);
    if (id == null) {
      ws.close();
      return;
    }
    const peer = new WebSocketClient(ws);
    network._addPeer(id, peer);
    peer._onOpen();
  });
}

import { IPeer } from "../core/network/peer";

export class WebSocketClient implements IPeer {
  public _onMsg!: (msg: Uint8Array) => void;
  public _onOpen!: () => void;
  public _onClose!: () => void;

  private readonly _url: string;
  private _ws: WebSocket | null = null;

  public constructor(url: string) {
    this._url = url;
    this._start();
  }

  private _start(): void {
    this._ws = new WebSocket(this._url);
    this._ws.binaryType = "arraybuffer";
    this._ws.addEventListener("open", (): void => {
      this._onOpen();
    });
    this._ws.addEventListener("message", (event: any): void => {
      const buf = new Uint8Array(event.data);
      this._onMsg(buf);
    });
    this._ws.addEventListener("close", (): void => {
      setTimeout(() => this._start(), 1000);
    });
  }

  public _send(msg: Uint8Array): void {
    if (this._ws != null && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(msg);
    }
  }
}

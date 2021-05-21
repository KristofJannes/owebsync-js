export declare class IPeer {
  _send(msg: Uint8Array): void;
  _onMsg: (msg: Uint8Array) => void;
  _onOpen: () => void;
  _onClose: () => void;
}

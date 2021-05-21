import { WebRTCClient } from "../../browser/webrtc";
import { Uint8ArrayReader } from "../lib/encoding";
import {
  DoneMessage,
  isChildrenMessage,
  isDoneMessage,
  isGetMessage,
  isPushMessage,
  isWebRTCICEMessage,
  isWebRTCPeersMessage,
  isWebRTCSDPAnswerMessage,
  isWebRTCSDPOfferMessage,
  Message,
  WebRTCPeersMessage,
} from "./messages";
import { IPeer } from "./peer";

// Abstraction for an OWebSync instance (to break cyclic import)
export type MsgHandler = {
  _handleMessage: (msg: Message) => Promise<Uint8Array | null>;
};

export class Network {
  // The id of this node
  private _id: string;
  // Wheter to allow WebRTC or not
  private _noWebRTC: boolean;

  // All connected peers
  private _peers: Map<string, IPeer> = new Map();
  // All peers who are currencly busy syncing with this node
  private _busyPeers: Set<string> = new Set();

  // The latest top-level GET message, to be send to each new peer
  private _rootGetMsg?: Uint8Array;

  // The OWebSync instance
  public _msgHandler!: MsgHandler;

  public constructor(
    id: string,
    noWebRTC: boolean,
    iceServers?: RTCIceServer[]
  ) {
    this._id = id;
    this._noWebRTC = noWebRTC;
    if (iceServers != null) {
      WebRTCClient._iceServers = iceServers;
    }
  }

  /**
   * Broadcast the given message to all idle peers.
   * This is the top-level GET message.
   */
  public _broadcast(msg: Uint8Array) {
    this._rootGetMsg = msg;
    for (const [id, peer] of this._peers.entries()) {
      if (!this._busyPeers.has(id)) {
        peer._send(msg);
        this._busyPeers.add(id);
      }
    }
  }

  /**
   * Add a new peer with the given id and setup all event listeners.
   */
  public _addPeer(id: string, peer: IPeer): void {
    this._peers.set(id, peer);
    peer._onOpen = () => {
      // the side with the highest id starts by sending its top-level hash.
      if (this._id > id) {
        if (this._rootGetMsg != null) {
          this._busyPeers.add(id);
          peer._send(this._rootGetMsg);
        }
      }

      // everyone sends their list of peers
      peer._send(
        new WebRTCPeersMessage(Array.from(this._peers.keys()))
          ._encode()
          ._uint8array()
      );
    };
    peer._onClose = () => {
      this._peers.delete(id);
      this._busyPeers.delete(id);

      if (!this._noWebRTC && this._peers.size < 7) {
        // If this node has less than 7 peers, ask around to find more peers.
        for (const peer of this._peers.values()) {
          peer._send(
            new WebRTCPeersMessage(Array.from(this._peers.keys()))
              ._encode()
              ._uint8array()
          );
        }
      }
    };
    peer._onMsg = async (msg: Uint8Array) => {
      const message: Message = Message._decode(new Uint8ArrayReader(msg));
      if (isWebRTCPeersMessage(message)) {
        if (!this._noWebRTC) {
          if (this._peers.size < 7) {
            for (const p of message._peers) {
              if (p != this._id && p !== "" && !this._peers.has(p)) {
                this._addPeer(p, new WebRTCClient(peer, this._id, p));
              }
            }
          }
        }
      } else if (isWebRTCSDPOfferMessage(message)) {
        if (message._to === this._id) {
          if (!this._noWebRTC) {
            if (this._peers.has(message._from)) {
              if (this._id < id) {
                const p = this._peers.get(message._from)!;
                p._onMsg = () => {};
                this._peers.delete(message._from);
              } else {
                return;
              }
            }
            this._addPeer(
              message._from,
              new WebRTCClient(peer, this._id, message._from, message._sdp)
            );
          }
        } else if (this._peers.has(message._to)) {
          this._peers.get(message._to)!._send(msg);
        }
      } else if (isWebRTCSDPAnswerMessage(message)) {
        if (message._to === this._id) {
          if (!this._noWebRTC) {
            if (this._peers.has(message._from)) {
              (this._peers.get(message._from)! as WebRTCClient)._acceptAccept(
                message._sdp
              );
            }
          }
        } else if (this._peers.has(message._to)) {
          this._peers.get(message._to)!._send(msg);
        }
      } else if (isWebRTCICEMessage(message)) {
        if (message._to === this._id) {
          if (!this._noWebRTC) {
            if (this._peers.has(message._from)) {
              (
                this._peers.get(message._from)! as WebRTCClient
              )._acceptICECandidate(message._candidate);
            }
          }
        } else if (this._peers.has(message._to)) {
          this._peers.get(message._to)!._send(msg);
        }
      } else if (isDoneMessage(message)) {
        this._busyPeers.delete(id);
      } else if (
        isGetMessage(message) ||
        isPushMessage(message) ||
        isChildrenMessage(message)
      ) {
        this._busyPeers.add(id);
        const answer = await this._msgHandler._handleMessage(message);
        if (answer == null) {
          this._busyPeers.delete(id);
          peer._send(new DoneMessage()._encode()._uint8array());
        } else {
          peer._send(answer);
        }
      }
    };
  }
}

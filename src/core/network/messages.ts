import { RemovedItem } from "../crdt/ORMapRemovedItem";
import { AssertionFailed } from "../errors";
import { Uint8ArrayReader, Uint8ArrayWriter } from "../lib/encoding";

export const enum MessageKind {
  // end of synchronization round
  DONE = 1,
  // request a CRDT (if hash doesn't match)
  GET = 2,
  // send a CRDT
  PUSH = 3,
  // send a message for a child (another MessageKind will be embedded in it)
  CHILDREN = 4,

  // get a list of all WebRTC peers
  WEBRTC_PEERS = 10,
  // send a WebRTC offer
  WEBRTC_SDP_OFFER = 11,
  // reply to a WebRTC offer
  WEBRTC_SDP_ANSWER = 12,
  // send a WebRTC ICE candidate
  WEBRTC_ICE = 13,
}

export class Message {
  public readonly _kind: MessageKind;

  public constructor(kind: MessageKind) {
    this._kind = kind;
  }

  public _encode(
    writer: Uint8ArrayWriter = new Uint8ArrayWriter()
  ): Uint8ArrayWriter {
    writer._writeByte(this._kind);
    return writer;
  }

  public static _decode(reader: Uint8ArrayReader): Message {
    const kind: MessageKind = reader._readByte();
    switch (kind) {
      case MessageKind.DONE:
        return DoneMessage._decode();
      case MessageKind.GET:
        return GetMessage._decode(reader);
      case MessageKind.PUSH:
        return PushMessage._decode(reader);
      case MessageKind.CHILDREN:
        return ChildrenMessage._decode(reader);
      case MessageKind.WEBRTC_PEERS:
        return WebRTCPeersMessage._decode(reader);
      case MessageKind.WEBRTC_SDP_OFFER:
        return WebRTCSDPOfferMessage._decode(reader);
      case MessageKind.WEBRTC_SDP_ANSWER:
        return WebRTCSDPAnswerMessage._decode(reader);
      case MessageKind.WEBRTC_ICE:
        return WebRTCICEMessage._decode(reader);
      default:
        throw AssertionFailed;
    }
  }
}

export class DoneMessage extends Message {
  public constructor() {
    super(MessageKind.DONE);
  }

  public static _decode(): DoneMessage {
    return new DoneMessage();
  }
}

export function isDoneMessage(msg: Message): msg is DoneMessage {
  return msg._kind === MessageKind.DONE;
}

export class GetMessage extends Message {
  public readonly _hash: string;

  public constructor(hash: string) {
    super(MessageKind.GET);
    this._hash = hash;
  }

  public _encode(
    writer: Uint8ArrayWriter = new Uint8ArrayWriter()
  ): Uint8ArrayWriter {
    super._encode(writer);
    writer._writeString(this._hash);
    return writer;
  }

  public static _decode(reader: Uint8ArrayReader): GetMessage {
    const hash = reader._readString();
    return new GetMessage(hash);
  }
}

export function isGetMessage(msg: Message): msg is GetMessage {
  return msg._kind === MessageKind.GET;
}

export class PushMessage extends Message {
  public readonly _crdt: Uint8Array;

  public constructor(crdt: Uint8Array) {
    super(MessageKind.PUSH);
    this._crdt = crdt;
  }

  public _encode(
    writer: Uint8ArrayWriter = new Uint8ArrayWriter()
  ): Uint8ArrayWriter {
    super._encode(writer);
    writer._writeUint8Array(this._crdt);
    return writer;
  }

  public static _decode(reader: Uint8ArrayReader): PushMessage {
    const crdt = reader._readUint8Array();
    return new PushMessage(crdt);
  }
}

export function isPushMessage(msg: Message): msg is PushMessage {
  return msg._kind === MessageKind.PUSH;
}

export class ChildrenMessage extends Message {
  // tag of the CRDT at this level in the tree, when the tags doesn't match,
  //  the message will be discarded, as we need information from higher up
  public readonly _tag: string;
  // list of all new removed items
  public readonly _removed: Array<RemovedItem>;
  // new/updated child paths
  public readonly _children: {
    [key: string]: GetMessage | PushMessage | ChildrenMessage;
  };

  public constructor(
    tag: string,
    removed: Array<RemovedItem>,
    children: {
      [key: string]: GetMessage | PushMessage | ChildrenMessage;
    }
  ) {
    super(MessageKind.CHILDREN);
    this._tag = tag;
    this._removed = removed;
    this._children = children;
  }

  public _encode(
    writer: Uint8ArrayWriter = new Uint8ArrayWriter()
  ): Uint8ArrayWriter {
    super._encode(writer);
    writer._writeString(this._tag);
    writer._writeVarInt(this._removed.length);
    for (const r of this._removed) {
      r._encode(writer);
    }
    writer._writeVarInt(Object.keys(this._children).length);
    for (const [key, value] of Object.entries(this._children)) {
      writer._writeString(key);
      value._encode(writer);
    }
    return writer;
  }

  public static _decode(reader: Uint8ArrayReader): ChildrenMessage {
    const tag = reader._readString();
    const removedLength = reader._readVarInt();
    const removed = new Array(removedLength);
    for (let i = 0; i < removedLength; i++) {
      removed[i] = RemovedItem._decode(reader);
    }
    const childrenLength = reader._readVarInt();
    const children: {
      [key: string]: GetMessage | PushMessage | ChildrenMessage;
    } = {};
    for (let i = 0; i < childrenLength; i++) {
      const key = reader._readString();
      const value = Message._decode(reader) as
        | GetMessage
        | PushMessage
        | ChildrenMessage;
      children[key] = value;
    }
    return new ChildrenMessage(tag, removed, children);
  }
}

export function isChildrenMessage(msg: Message): msg is ChildrenMessage {
  return msg._kind === MessageKind.CHILDREN;
}

export class WebRTCPeersMessage extends Message {
  public readonly _peers: string[];

  public constructor(peers: string[]) {
    super(MessageKind.WEBRTC_PEERS);
    this._peers = peers;
  }

  public _encode(
    writer: Uint8ArrayWriter = new Uint8ArrayWriter()
  ): Uint8ArrayWriter {
    super._encode(writer);
    writer._writeVarInt(this._peers.length);
    for (const peer of this._peers) {
      writer._writeString(peer);
    }
    return writer;
  }

  public static _decode(reader: Uint8ArrayReader): WebRTCPeersMessage {
    const peersLength = reader._readVarInt();
    const peers = new Array(peersLength);
    for (let i = 0; i < peersLength; i++) {
      peers[i] = reader._readString();
    }
    return new WebRTCPeersMessage(peers);
  }
}

export function isWebRTCPeersMessage(msg: Message): msg is WebRTCPeersMessage {
  return msg._kind === MessageKind.WEBRTC_PEERS;
}

export class WebRTCSDPOfferMessage extends Message {
  public readonly _from: string;
  public readonly _to: string;
  public readonly _sdp: string;

  public constructor(from: string, to: string, sdp: string) {
    super(MessageKind.WEBRTC_SDP_OFFER);
    this._from = from;
    this._to = to;
    this._sdp = sdp;
  }

  public _encode(
    writer: Uint8ArrayWriter = new Uint8ArrayWriter()
  ): Uint8ArrayWriter {
    super._encode(writer);
    writer._writeString(this._from);
    writer._writeString(this._to);
    writer._writeString(this._sdp);
    return writer;
  }

  public static _decode(reader: Uint8ArrayReader): WebRTCSDPOfferMessage {
    const from = reader._readString();
    const to = reader._readString();
    const sdp = reader._readString();
    return new WebRTCSDPOfferMessage(from, to, sdp);
  }
}

export function isWebRTCSDPOfferMessage(
  msg: Message
): msg is WebRTCSDPOfferMessage {
  return msg._kind === MessageKind.WEBRTC_SDP_OFFER;
}

export class WebRTCSDPAnswerMessage extends Message {
  public readonly _from: string;
  public readonly _to: string;
  public readonly _sdp: string;

  public constructor(from: string, to: string, sdp: string) {
    super(MessageKind.WEBRTC_SDP_ANSWER);
    this._from = from;
    this._to = to;
    this._sdp = sdp;
  }

  public _encode(
    writer: Uint8ArrayWriter = new Uint8ArrayWriter()
  ): Uint8ArrayWriter {
    super._encode(writer);
    writer._writeString(this._from);
    writer._writeString(this._to);
    writer._writeString(this._sdp);
    return writer;
  }

  public static _decode(reader: Uint8ArrayReader): WebRTCSDPAnswerMessage {
    const from = reader._readString();
    const to = reader._readString();
    const sdp = reader._readString();
    return new WebRTCSDPAnswerMessage(from, to, sdp);
  }
}

export function isWebRTCSDPAnswerMessage(
  msg: Message
): msg is WebRTCSDPAnswerMessage {
  return msg._kind === MessageKind.WEBRTC_SDP_ANSWER;
}

export class WebRTCICEMessage extends Message {
  public readonly _from: string;
  public readonly _to: string;
  public readonly _candidate: string;

  public constructor(from: string, to: string, candidate: string) {
    super(MessageKind.WEBRTC_ICE);
    this._from = from;
    this._to = to;
    this._candidate = candidate;
  }

  public _encode(
    writer: Uint8ArrayWriter = new Uint8ArrayWriter()
  ): Uint8ArrayWriter {
    super._encode(writer);
    writer._writeString(this._from);
    writer._writeString(this._to);
    writer._writeString(this._candidate);
    return writer;
  }

  public static _decode(reader: Uint8ArrayReader): WebRTCICEMessage {
    const from = reader._readString();
    const to = reader._readString();
    const candidate = reader._readString();
    return new WebRTCICEMessage(from, to, candidate);
  }
}

export function isWebRTCICEMessage(msg: Message): msg is WebRTCICEMessage {
  return msg._kind === MessageKind.WEBRTC_ICE;
}

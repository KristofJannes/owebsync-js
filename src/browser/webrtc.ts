import { AssertionFailed } from "../core/errors";
import {
  Message,
  WebRTCICEMessage,
  WebRTCSDPAnswerMessage,
  WebRTCSDPOfferMessage,
} from "../core/network/messages";
import { IPeer } from "../core/network/peer";

export class WebRTCClient implements IPeer {
  public _onMsg!: (msg: Uint8Array) => void;
  public _onOpen!: () => void;
  public _onClose!: () => void;

  private _signalingChannel: IPeer;
  private _peerConnection: RTCPeerConnection;
  private _dataChannel: RTCDataChannel | null = null;

  public static _iceServers: RTCIceServer[] = [
    {
      urls: ["stun:stun.l.google.com:19302"],
    },
  ];

  public constructor(
    signalingChannel: IPeer,
    localId: string,
    remoteId: string,
    offer?: string
  ) {
    this._signalingChannel = signalingChannel;
    this._peerConnection = new RTCPeerConnection({
      iceServers: WebRTCClient._iceServers,
    });

    if (offer == null) {
      this._sendOffer(localId, remoteId);
    } else {
      this._acceptOffer(localId, remoteId, offer);
    }
  }

  private _setupDataChannel() {
    this._dataChannel!.addEventListener("open", (): void => {
      this._onOpen();
    });
    this._dataChannel!.addEventListener("close", (): void => {
      this._onClose();
    });
    this._dataChannel!.addEventListener("message", (event: any): void => {
      const buf = new Uint8Array(event.data);
      this._onMsg(buf);
    });
  }

  private async _sendOffer(localId: string, remoteId: string): Promise<void> {
    this._dataChannel = this._peerConnection.createDataChannel("dc");
    this._setupDataChannel();
    const offer: RTCSessionDescriptionInit =
      await this._peerConnection.createOffer();
    if (offer.sdp == null) {
      throw AssertionFailed;
    }

    const msg: Message = new WebRTCSDPOfferMessage(
      localId,
      remoteId,
      offer.sdp
    );
    this._signalingChannel._send(msg._encode()._uint8array());

    this._peerConnection.onicecandidate = (ev): void => {
      const candidate: RTCIceCandidate | null = ev.candidate;
      if (candidate != null) {
        const msg: Message = new WebRTCICEMessage(
          localId,
          remoteId,
          JSON.stringify(candidate.toJSON())
        );
        this._signalingChannel._send(msg._encode()._uint8array());
      }
    };
    await this._peerConnection.setLocalDescription(offer);
  }

  private async _acceptOffer(
    localId: string,
    remoteId: string,
    sdp: string
  ): Promise<void> {
    const offer: RTCSessionDescription = new RTCSessionDescription({
      sdp: sdp,
      type: "offer",
    });
    await this._peerConnection.setRemoteDescription(offer);
    const answer: RTCSessionDescriptionInit =
      await this._peerConnection.createAnswer();
    if (answer.sdp == null) {
      throw AssertionFailed;
    }

    const msg: Message = new WebRTCSDPAnswerMessage(
      localId,
      remoteId,
      answer.sdp
    );
    this._signalingChannel._send(msg._encode()._uint8array());

    this._peerConnection.onicecandidate = (ev): void => {
      const candidate: RTCIceCandidate | null = ev.candidate;
      if (candidate != null) {
        const msg: Message = new WebRTCICEMessage(
          localId,
          remoteId,
          JSON.stringify(candidate.toJSON())
        );
        this._signalingChannel._send(msg._encode()._uint8array());
      }
    };
    this._peerConnection.ondatachannel = (ev): void => {
      this._dataChannel = ev.channel;
      this._setupDataChannel();
    };
    await this._peerConnection.setLocalDescription(answer);
  }

  public async _acceptAccept(sdp: string): Promise<void> {
    const answer: RTCSessionDescription = new RTCSessionDescription({
      sdp: sdp,
      type: "answer",
    });
    await this._peerConnection.setRemoteDescription(answer);
  }

  public async _acceptICECandidate(iceCandidate: string): Promise<void> {
    const candidate = new RTCIceCandidate(JSON.parse(iceCandidate));
    this._peerConnection.addIceCandidate(candidate);
  }

  public _send(msg: Uint8Array): void {
    if (this._dataChannel != null && this._dataChannel.readyState === "open") {
      this._dataChannel.send(msg);
    }
  }
}

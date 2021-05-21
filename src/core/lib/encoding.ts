import { utf8Read, utf8Write } from "./utf8";

const INITIAL_BUFFER_SIZE = 1024;

export class Uint8ArrayReader extends Uint8Array {
  private _position: number = 0;

  constructor(buffer: Uint8Array) {
    super(buffer);
  }

  public _readByte(): number {
    return this[this._position++];
  }

  public _readVarInt(): number {
    let num = 0;
    let b: number = this[this._position++];
    let s = 0;
    while (b >= 0x80) {
      num |= (b & 0x7f) << s;
      s += 7;
      b = this[this._position++];
    }
    num |= (b & 0x7f) << s;
    return num;
  }

  public _readUint8Array(): Uint8Array {
    const size: number = this._readVarInt();
    return this.slice(this._position, (this._position += size));
  }

  public _readString(): string {
    return utf8Read(this._readUint8Array());
  }
}

export class Uint8ArrayWriter {
  private _position: number = 0;
  private _buffer: Uint8Array = new Uint8Array(INITIAL_BUFFER_SIZE);

  public _writeByte(b: number): void {
    if (b > 255) {
      throw "";
    }
    this._allocate(1);
    this._buffer[this._position++] = b;
  }

  public _writeVarInt(n: number): void {
    if (n < 0) {
      throw "";
    }
    while (n > 0x7f) {
      this._allocate(1);
      this._buffer[this._position++] = (n & 0x7f) | 0x80;
      n >>>= 7;
    }
    this._allocate(1);
    this._buffer[this._position++] = n;
  }

  public _writeUint8Array(buf: Uint8Array): void {
    this._writeVarInt(buf.length);
    this._allocate(buf.length);
    this._buffer.set(buf, this._position);
    this._position += buf.length;
  }

  public _writeString(s: string): void {
    this._writeUint8Array(utf8Write(s));
  }

  public _uint8array(): Uint8Array {
    return new Uint8Array(this._buffer.buffer.slice(0, this._position));
  }

  private _allocate(size: number) {
    let length: number = this._buffer.length;

    if (length < this._position + size) {
      while (length < this._position + size) {
        length *= 2;
      }

      const buf: Uint8Array = new Uint8Array(length);
      buf.set(this._buffer);
      this._buffer = buf;
    }
  }
}

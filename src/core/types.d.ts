declare type Json =
  | string
  | number
  | boolean
  | {
      [key: string]: Json;
    };

export declare class OWebSync {
  get<T extends unknown>(path: string): Promise<T>;
  listen(path: string, callback: (o: unknown) => void): Promise<void>;
  set(path: string, value: Json): Promise<void>;
  del(path: string): Promise<void>;
  getUUID(): Promise<string>;
}

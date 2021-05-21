import * as http from "http";
import { OWebSync as OWebSyncImpl } from "../core";
import { Network } from "../core/network/network";
import { OWebSync as OWebSyncType } from "../core/types";
import { LevelDBStore } from "./store";
import { startServer } from "./ws";

export default async function OWebSync(
  server: http.Server
): Promise<OWebSyncType> {
  const id = ""; // no id required for non-WebRTC peers
  const store = new LevelDBStore();
  const network = new Network(id, true);
  const owebsync = await OWebSyncImpl._build(id, store, network);
  startServer(server, network);
  return owebsync;
}

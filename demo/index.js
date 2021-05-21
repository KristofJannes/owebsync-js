import express from "express";
import OWebSync from "owebsync-js";

const app = express();
app.use(express.static("static"));
app.use(express.static("node_modules/owebsync-js/dist"));

const server = app.listen(process.env.PORT || 8080);

OWebSync(server);

process.on("SIGINT", () => process.exit(1));

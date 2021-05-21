# OWebSync

> Seamless Synchronization of Distributed Web Clients

More info: [https://distrinet.cs.kuleuven.be/software/owebsync/](https://distrinet.cs.kuleuven.be/software/owebsync/)

## Basic usage

### NodeJS server

```javascript
const OWebSync = require("owebsync-nodejs");
const server = http.createServer();
OWebSync(server);
server.listen(8080);
```

### Browser server

```html
<script src="owebsync-browser.js"></script>
<script>
  OWebSync("ws://localhost:8081").then(async (owebsync) => {
    await owebsync.set("drawing1.object36.color", "#f00");
  }
</script>
```

---

<p>
  <a href="https://distrinet.cs.kuleuven.be">
    <img src="https://distrinet.cs.kuleuven.be/software/owebsync/images/distrinet.svg" height="32">
  </a>
  <a href="https://www.kuleuven.be/english/">
    <img src="https://distrinet.cs.kuleuven.be/software/owebsync/images/kuleuven.svg" height="32">
  </a>
</p>

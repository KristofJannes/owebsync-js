function getRandomColor() {
  return ["#afdef9", "#479cc2", "#006994"][Math.floor(Math.random() * 3)];
}

OWebSync(
  `${location.protocol === "http:" ? "ws" : "wss"}://${location.host}`
).then((owebsync) => {
  const defaultOnTouchStartHandler = fabric.Canvas.prototype._onTouchStart;
  fabric.util.object.extend(fabric.Canvas.prototype, {
    _onTouchStart: function (e) {
      var target = this.findTarget(e);
      // if allowTouchScrolling is enabled, no object was at the
      // the touch position and we're not in drawing mode, then
      // let the event skip the fabricjs canvas and do default
      // behavior
      if (this.allowTouchScrolling && !target && !this.isDrawingMode) {
        // returning here should allow the event to propagate and be handled
        // normally by the browser
        return;
      }

      // otherwise call the default behavior
      defaultOnTouchStartHandler.call(this, e);
    },
  });

  const canvas = new fabric.Canvas("c", {
    allowTouchScrolling: true,
    enableRetinaScaling: false,
    includeDefaultValues: false,
    selection: false,
    skipOffscreen: true,
  });

  canvas.setHeight(720);
  canvas.setWidth(1280);

  const objects = new Map();

  owebsync.listen("", (o) => {
    for (const [k, v] of Object.entries(o)) {
      if (!objects.has(k)) {
        let obj;
        if (v.type === "rect") {
          obj = new fabric.Rect(v);
        } else if (v.type === "circle") {
          obj = new fabric.Circle(v);
        } else if (v.type === "triangle") {
          obj = new fabric.Triangle(v);
        }
        if (obj != null) {
          obj.includeDefaultValues = false;
          obj.id = k;
          canvas.add(obj);
          objects.set(k, obj);
          owebsync.listen(k, (o) => {
            try {
              obj.setOptions(o);
              obj.setCoords();
              canvas.requestRenderAll();
            } catch {}
          });
        }
      }
    }

    for (const key of objects.keys()) {
      if (!Object.keys(o).includes(key)) {
        canvas.remove(objects.get(key));
        objects.delete(key);
      }
    }
  });

  const options = document.querySelector(".options");

  canvas.on("selection:created", () => {
    options.style.display = "block";
  });
  canvas.on("selection:cleared", () => {
    options.style.display = "none";
  });

  canvas.on("object:modified", async (evt) => {
    evt.target.includeDefaultValues = false;
    const obj = evt.target.toObject();
    await owebsync.set(evt.target.id, obj);
  });

  canvas.on("object:moving", (evt) => {
    const obj = evt.target;
    obj.setCoords();
    const bounds = obj.getBoundingRect();
    if (bounds.top < 0 || bounds.left < 0) {
      obj.top = Math.max(obj.top, obj.top - bounds.top);
      obj.left = Math.max(obj.left, obj.left - bounds.left);
    }
    if (
      bounds.top + bounds.height > canvas.height ||
      bounds.left + bounds.width > canvas.width
    ) {
      obj.top = Math.min(
        obj.top,
        canvas.height - bounds.height + obj.top - bounds.top
      );
      obj.left = Math.min(
        obj.left,
        canvas.width - bounds.width + obj.left - bounds.left
      );
    }
  });

  document.querySelector("#btnAddRect").addEventListener("click", async () => {
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      fill: getRandomColor(),
      height: 50,
      width: 50,
    });
    rect.includeDefaultValues = false;
    rect.id = await owebsync.getUUID();
    await owebsync.set(rect.id, rect.toObject());
  });

  document
    .querySelector("#btnAddCircle")
    .addEventListener("click", async () => {
      const circle = new fabric.Circle({
        left: 100,
        top: 100,
        fill: getRandomColor(),
        radius: 50,
      });
      circle.includeDefaultValues = false;
      circle.id = await owebsync.getUUID();
      await owebsync.set(circle.id, circle.toObject());
    });

  document
    .querySelector("#btnAddTriangle")
    .addEventListener("click", async () => {
      const triangle = new fabric.Triangle({
        left: 100,
        top: 100,
        fill: getRandomColor(),
        height: 50,
        width: 50,
      });
      triangle.includeDefaultValues = false;
      triangle.id = await owebsync.getUUID();
      await owebsync.set(triangle.id, triangle.toObject());
    });

  document.querySelector("#btnRemove").addEventListener("click", async () => {
    const obj = canvas.getActiveObject();
    await owebsync.del(obj.id);
  });

  document.querySelector("#btnColor1").addEventListener("click", async () => {
    const obj = canvas.getActiveObject();
    await owebsync.set(`${obj.id}.fill`, "#4a9cc2");
  });

  document.querySelector("#btnColor2").addEventListener("click", async () => {
    const obj = canvas.getActiveObject();
    await owebsync.set(`${obj.id}.fill`, "#4bc3ad");
  });

  document.querySelector("#btnColor3").addEventListener("click", async () => {
    const obj = canvas.getActiveObject();
    await owebsync.set(`${obj.id}.fill`, "#006994");
  });

  document.querySelector("#btnColor4").addEventListener("click", async () => {
    const obj = canvas.getActiveObject();
    await owebsync.set(`${obj.id}.fill`, "#afdff9");
  });

  document.querySelector("#btnColor5").addEventListener("click", async () => {
    const obj = canvas.getActiveObject();
    await owebsync.set(`${obj.id}.fill`, "#9dc34b");
  });

  document.querySelector("#btnColor6").addEventListener("click", async () => {
    const obj = canvas.getActiveObject();
    await owebsync.set(`${obj.id}.fill`, "#c34b61");
  });

  document.querySelector("#btnColor7").addEventListener("click", async () => {
    const obj = canvas.getActiveObject();
    await owebsync.set(`${obj.id}.fill`, "#714bc3");
  });
});

/* Javascript */
$(function () {
  $('.btn-copy')
    .mouseleave(function () {
      var $element = $(this);
      $element.tooltip('hide').tooltip('disable');
    })

  var clipboard = new Clipboard('.btn-copy');
  clipboard.on('success', function (e) {
    $(e.trigger)
      .attr('title', 'Copied')
      .tooltip('fixTitle')
      .tooltip('enable')
      .tooltip('show');
  })

  $('[data-toggle=tooltip]').tooltip({
    trigger: 'hover',
  });
})
window.LOCAL_URL = '/'; // http://localhost:17310/';
window.LOCAL_VERSION = '0.0.3';

window.app = new Vue({
  el: '#app',
  data: {
    deviceUdid: deviceUdid,
    device: {
      ip: deviceIp,
      port: 7912,
    },
    deviceInfo: {},
    fixConsole: '', // log for fix minicap and rotation
    navtabs: {
      active: location.hash.slice(1) || 'home',
      tabs: [],
    },
    error: '',
    control: null,
    loading: true,
    canvas: {
      bg: null,
      fg: null,
    },
    canvasStyle: {
      opacity: 1,
      width: 'inherit',
      height: 'inherit'
    },
    canvasStyleTree: {
      opacity: 1,
      width: 'inherit',
      height: 'inherit'
    },
    lastScreenSize: {
      screen: {},
      canvas: {
        width: 1,
        height: 1
      }
    },
    whatsinput: {
      text: "",
      disabled: true,
    },
    websockets:{
      winput: null,
    },
    power:"755",
    path:"/data/local/tmp/",
    screenWS: null,
    browserURL: "",
    logcat: {
      follow: true,
      tagColors: {},
      lineNumber: 0,
      maxKeep: 1500,
      cachedScrollTop: 0,
      logs: [{
        lineno: 1,
        tag: "EsService2",
        level: "W",
        content: "loaded /system/lib/egl/libEGL_adreno200.so",
      }]
    },
    imageBlobBuffer: [],
    videoUrl: '',
    videoReceiver: null, // sub function to receive image
    inputText: '',
    inputWS: null,
    platform: localStorage.platform || 'Android',
    imagePool:null,
    showCursorPercent: true,
    cursor: {},
    elem:{"name":"","description":"","text":"","touchable":"","resourceId":"","clickable":"",
          "package":"","label":"","width":"","height":"","enabled":"","visible":"","tag":"","anchor":"",
          "className":"","type":""},
    userSettings: Object.assign({
      inputName: '',
      inputCommand: '',
      visible: false,
      shortcuts: [{
        command: "input keyevent POWER",
        name: '删除',
      }]
    }, {}),
    topApp: {
      packageName: '',
      activity: '',
      pid: '',
    },

  },
  watch: {
    platform: function (newval) {
      localStorage.setItem('platform', newval);
    },
    serial: function (newval) {
      localStorage.setItem('serial', newval);
    }
  },
  computed: {
    cursorValue: function () {
      if (this.showCursorPercent) {
        return { x: this.cursor.px, y: this.cursor.py }
      } else {
        return this.cursor
      }
    },
    nodes: function () {
      return this.originNodes
    },
    // elem: function () {
    //   return this.nodeSelected || {};
    // },
    elemXpath: function () {
      var xpath = '//' + (this.elem.className || '*');
      if (this.elem.text) {
        xpath += "[@text='" + this.elem.text + "']";
      }
      return xpath;
    },
    deviceUrl: function () {
      return "http://" + this.device.ip + ":" + this.device.port;
    }
  },
  mounted: function () {
    this.imagePool = new ImagePool(100);
    var self = this;
    $.notify.defaults({ className: "success" });

    this.canvas.bg = document.getElementById('bgCanvas');
    this.canvas.fg = document.getElementById('fgCanvas');
    this.canvas.bg_tree = document.getElementById('bgCanvas_tree');
    this.canvas.fg_tree = document.getElementById('fgCanvas_tree');
    window.c = this.canvas.bg;

    //重新调整大小
    $(window).resize(function () {
      self.resizeScreen();
    });

    //初始化jstree
    this.initJstree();
    //为知
    this.activeMouseControl();
    //检查版本
    // this.checkVersion();
    this.initDragDealer();

    (function (that,_device) {
      that.deviceInfo = _device;
      document.title = _device.model;
      $('#json-renderer').jsonViewer(device, {});
    })(this,device);

    this.reserveDevice()
      .then(function () {
        this.enableTouch();
        this.openScreenStream();
      }.bind(this))

    // wakeup device on connect
    setTimeout(function () {
      this.keyevent("WAKEUP");
    }.bind(this), 1)

    window.k = setTimeout(function () {
      var lineno = (this.logcat.lineNumber += 1);
      this.logcat.logs.push({
        lineno: lineno,
        tag: "EsService2",
        level: "W",
        content: "loaded /system/lib/egl/libEGL_adreno200.so",
      });
      if (this.logcat.follow) {
        // only keep maxKeep lines
        var maxKeep = Math.max(20, this.logcat.maxKeep);
        var size = this.logcat.logs.length;
        this.logcat.logs = this.logcat.logs.slice(size - maxKeep, size);

        // scroll to end
        var el = this.$refs.tab_content;
        var logcat = this.logcat;
        if (el.scrollTop < logcat.cachedScrollTop) {
          this.logcat.follow = false;
        } else {
          setTimeout(function () {
            logcat.cachedScrollTop = el.scrollTop = el.scrollHeight - el.clientHeight;
          }, 2);
        }
      }
    }.bind(this), 200);

    // 加载whatsinput输入法
    this.loadWhatsinput()
  },
  methods: {
    loadWhatsinput(callback) {
      let defer = $.Deferred()
      let ws = new WebSocket("ws://" + this.device.ip + ":6677" + "/whatsinput");
      this.websockets.winput = ws;
      ws.onopen = (ev) => {
        defer.resolve()
        console.log("whatsinput connected")
      }
      ws.onmessage = (ev) => {
        console.log("winput recv", ev)
        let data = JSON.parse(ev.data)
        switch (data.type) {
          case "InputStart":
            this.whatsinput.text = data.text;
            this.whatsinput.disabled = false;
            setTimeout(() => {
              this.$refs.whatsinput.focus()
            }, 1)
            break;
          case "InputFinish":
            this.whatsinput.disabled = true;
            break
          case "InputChange":
            this.whatsinput.text = data.text;
            break;
        }
      }
      ws.onerror = (ev) => {
        console.error(ev)
        defer.reject()
      }
      ws.onclose = (ev) => {
        console.log("winput closed")
        if (ws === this.websockets.winput) {
          this.websockets.winput = null;
          this.whatsinput.disabled = true;
          this.whatsinput.text = null;
        }
      }
      return defer;
    },
    sendInputText() {
        console.log("sync", this.whatsinput.text);
        let ws = this.websockets.winput;
        ws.send(JSON.stringify({
          type: "InputEdit",
          text: this.whatsinput.text,
        }))
    },
    sendInputKey(key) {
      console.log("Sync key", key)
      let code = { "enter": 66, "tab": 61 }[key] || key;
      let ws = this.websockets.winput;
      ws.send(JSON.stringify({
        type: "InputKey",
        code: "" + code,
      }))
    },
    runShell(command) {
      return $.ajax({
        method: "get",
        url: this.deviceUrl + "/shell",
        data: {
          "command": command,
        },
        dataType: "json"
      }).then(ret => {
        console.log("runShell", command, ret)
        return ret;
      })
    },
    nodes: function () {
      return this.originNodes
    },
    // elem: function () {
    //   return this.nodeSelected || {};
    // },
    screenDumpUI: function () {
      var self = this;
      this.loading = true;
      this.canvasStyleTree.opacity = 0.5;
      return this.screenRefresh()
        .fail(function (ret) {
          self.showAjaxError(ret);
        })
        .then(function () {
          return $.getJSON(LOCAL_URL + 'inspector/' + deviceUdid + '/hierarchy')
        })
        .fail(function (ret) {
          self.showAjaxError(ret);
        })
        .then(function (source) {
          localStorage.setItem('windowHierarchy', JSON.stringify(source));
          self.drawAllNodeFromSource(source);
        })
    },
    drawAllNodeFromSource: function (source) {
      var jstreeData = this.sourceToJstree(source);
      var jstree = this.$jstree.jstree(true);
      jstree.settings.core.data = jstreeData;
      jstree.refresh();

      var nodeMaps = this.originNodeMaps = {}

      function sourceToNodes(source) {
        var node = Object.assign({}, source, { children: undefined });
        nodeMaps[node.id] = node;
        var nodes = [node];
        if (source.children) {
          source.children.forEach(function (s) {
            nodes = nodes.concat(sourceToNodes(s))
          })
        }
        return nodes;
      }
      this.originNodes = sourceToNodes(source) //ret.nodes;
      this.drawAllNode();
      this.loading = false;
      this.canvasStyleTree.opacity = 1.0;
    },
    sourceToJstree: function (source) {
      var n = {}
      n.id = source.id;
      n.text = source.type || source.className
      if (source.name) {
        n.text += " - " + source.name;
      }
      if (source.resourceId) {
        n.text += " - " + source.resourceId;
      }
      n.icon = this.sourceTypeIcon(source.type);
      if (source.children) {
        n.children = []
        source.children.forEach(function (s) {
          n.children.push(this.sourceToJstree(s))
        }.bind(this))
      }
      return n;
    },
    sourceTypeIcon: function (widgetType) {
      switch (widgetType) {
        case "Scene":
          return "glyphicon glyphicon-tree-conifer"
        case "Layer":
          return "glyphicon glyphicon-equalizer"
        case "Camera":
          return "glyphicon glyphicon-facetime-video"
        case "Node":
          return "glyphicon glyphicon-leaf"
        case "ImageView":
          return "glyphicon glyphicon-picture"
        case "Button":
          return "glyphicon glyphicon-inbox"
        case "Layout":
          return "glyphicon glyphicon-tasks"
        case "Text":
          return "glyphicon glyphicon-text-size"
        default:
          return "glyphicon glyphicon-object-align-horizontal"
      }
    },
    drawRefresh: function () {
      this.drawAllNode()
      if (this.nodeHovered) {
        this.drawNode(this.nodeHovered, "blue")
      }
      if (this.nodeSelected) {
        this.drawNode(this.nodeSelected, "red")
        //selector update
        this.elem=this.nodeSelected
      }
    },
    drawNode: function (node, color, dashed) {
      if (!node || !node.rect) {
        return;
      }
      var x = node.rect.x,
        y = node.rect.y,
        w = node.rect.width,
        h = node.rect.height;
      color = color || 'black';
      var ctx = this.canvas.fg_tree.getContext('2d');
      var rectangle = new Path2D();
      rectangle.rect(x, y, w, h);
      if (dashed) {
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 10]);
      } else {
        ctx.lineWidth = 5;
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = color;
      ctx.stroke(rectangle);
    },
    generateNodeSelectorCode: function (node) {
      var params = this.generateNodeSelectorParams(node);
      return 'd(' + params.join(', ') + ')';
    },
    generateNodeSelectorParams: function (node) {
      var self = this;

      function combineKeyValue(key, value) {
        value = '"' + value + '"';
        if (['text', 'name', 'label', 'description'].indexOf(key) >= 0) {
          value = "u" + value; // python unicode
        }
        return key + '=' + value;
      }
      var index = 0;
      var params = [];
      var kvs = [];
      // iOS: name, label, className
      // Android: text, description, resourceId, className
      ['label', 'resourceId', 'name', 'text', 'type', 'tag', 'description', 'className'].some(function (key) {
        if (!node[key]) {
          return false;
        }
        params.push(combineKeyValue(key, node[key]));
        kvs.push([key, node[key]]);
        index = self.getNodeIndex(node.id, kvs);
        return self.codeShortFlag && index == 0;
      });
      if (index > 0) {
        params.push('instance=' + index);
      }
      return params;
    },
    generateNodeSelectorCode: function (node) {
      var params = this.generateNodeSelectorParams(node);
      return 'd(' + params.join(', ') + ')';
    },
    getNodeIndex: function (id, kvs) {
      var skip = false;
      return this.nodes().filter(function (node) {
        if (skip) {
          return false;
        }
        var ok = kvs.every(function (kv) {
          var k = kv[0],
            v = kv[1];
          return node[k] == v;
        })
        if (ok && id == node.id) {
          skip = true;
        }
        return ok;
      }).length - 1;
    },
    screenRefresh: function () {
      return $.getJSON(LOCAL_URL + 'inspector/' + deviceUdid + '/screenshot')
        .then(function (ret) {
          var blob = b64toBlob(ret.data, 'image/' + ret.type);
          this._drawBlobImageToScreen(blob);
          localStorage.setItem('screenshotBase64', ret.data);
        }.bind(this))
    },
    _drawBlobImageToScreen: function (blob) {
      // Support jQuery Promise
      var dtd = $.Deferred();
      var bgcanvas = this.canvas.bg_tree,
        fgcanvas = this.canvas.fg_tree,
        ctx = bgcanvas.getContext('2d'),
        self = this,
        URL = window.URL || window.webkitURL,
        BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
        img = this.imagePool.next();

      img.onload = function () {
        console.log("image")
        fgcanvas.width = bgcanvas.width=img.width
        fgcanvas.height = bgcanvas.height=img.height


        ctx.drawImage(img, 0, 0, img.width, img.height);
        self.resizeScreenTree(img);

        // Try to forcefully clean everything to get rid of memory
        // leaks. Note self despite this effort, Chrome will still
        // leak huge amounts of memory when the developer tools are
        // open, probably to save the resources for inspection. When
        // the developer tools are closed no memory is leaked.
        img.onload = img.onerror = null
        img.src = BLANK_IMG
        img = null
        blob = null

        URL.revokeObjectURL(url)
        url = null
        dtd.resolve();
      }

      img.onerror = function () {
        // Happily ignore. I suppose this shouldn't happen, but
        // sometimes it does, presumably when we're loading images
        // too quickly.

        // Do the same cleanup here as in onload.
        img.onload = img.onerror = null
        img.src = BLANK_IMG
        img = null
        blob = null

        URL.revokeObjectURL(url)
        url = null
        dtd.reject();
      }
      var url = URL.createObjectURL(blob)
      img.src = url;
      return dtd;
    },
    drawAllNode: function () {

      if (this.originNodes==undefined){
        return
      }
      var self = this;
      var canvas = self.canvas.fg_tree;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      self.nodes().forEach(function (node) {
        // ignore some types
        if (['Layout'].includes(node.type)) {
          return;
        }
        self.drawNode(node, 'black', true);
      })
    },
    drawHoverNode: function (pos) {
      if(this.originNodes==undefined){
        return
      }
      var self = this;
      var canvas = self.canvas.fg_tree;
      self.nodeHovered = null;
      var minArea = Infinity;

      function isInside(node, x, y) {
        if (!node.rect) {
          return false;
        }
        var lx = node.rect.x,
          ly = node.rect.y,
          rx = node.rect.width + lx,
          ry = node.rect.height + ly;
        return lx < x && x < rx && ly < y && y < ry;
      }
      var activeNodes = self.nodes().filter(function (node) {
        if (!isInside(node, pos.x, pos.y)) {
          return false;
        }
        if (!node.rect) {
          return false;
        }
        // skip some types
        console.log(node.type);
        if (['Layout', 'Sprite'].includes(node.type)) {
          return false;
        }
        var area = node.rect.width * node.rect.height;
        if (area <= minArea) {
          minArea = area;
          self.nodeHovered = node;
        }
        return true;
      })
      activeNodes.forEach(function (node) {
        self.drawNode(node, "blue", true)
      })
      self.drawNode(self.nodeHovered, "blue");
    },
    checkVersion: function () {
      var self = this;
      $.ajax({
        url: LOCAL_URL + "api/v1/version",
        type: "GET",
        //contentType: "application/json; charset=utf-8"
      })
        .done(function (ret) {
          console.log("version", ret.name);
          if (ret.name !== LOCAL_VERSION) {
            self.showError("Expect local server version: " + LOCAL_VERSION + " but got " + ret.name + ", Maybe you need upgrade 'weditor'");
            return
          }
          var lastScreenshotBase64 = localStorage.screenshotBase64;
          if (lastScreenshotBase64) {
            var blob = b64toBlob(lastScreenshotBase64, 'image/jpeg');
            self._drawBlobImageToScreen(blob);
            self.canvasStyleTree.opacity = 1.0;
          }
          if (localStorage.windowHierarchy) {
            // self.originNodes = JSON.parse(localStorage.windowHierarchy);
            var source = JSON.parse(localStorage.windowHierarchy);
            self.drawAllNodeFromSource(source);
            self.loading = false;
            self.canvasStyleTree.opacity = 1.0;
          }
        })
        .fail(function (ret) {
          self.showError("<p>Local server not started, start with</p><pre>$ python -m weditor</pre>");
        })
        .always(function () {
          self.loading = false;
        })
    },
    activeMouseControl: function () {
      var self = this;
      var element = this.canvas.fg_tree;

      var screen = {
        bounds: {}
      }

      function calculateBounds() {
        var el = element;
        screen.bounds.w = el.offsetWidth
        screen.bounds.h = el.offsetHeight
        screen.bounds.x = 0
        screen.bounds.y = 0

        while (el.offsetParent) {
          screen.bounds.x += el.offsetLeft
          screen.bounds.y += el.offsetTop
          el = el.offsetParent
        }
      }

      function activeFinger(index, x, y, pressure) {
        var scale = 0.5 + pressure
        $(".finger-" + index)
          .addClass("active")
          .css("transform", 'translate3d(' + x + 'px,' + y + 'px,0)')
      }

      function deactiveFinger(index) {
        $(".finger-" + index).removeClass("active")
      }

      function mouseMoveListener(event) {
        var e = event
        if (e.originalEvent) {
          e = e.originalEvent
        }
        // Skip secondary click
        if (e.which === 3) {
          return
        }
        e.preventDefault()

        var pressure = 0.5
        activeFinger(0, e.pageX, e.pageY, pressure);
        // that.touchMove(0, x / screen.bounds.w, y / screen.bounds.h, pressure);
      }

      function mouseUpListener(event) {
        var e = event
        if (e.originalEvent) {
          e = e.originalEvent
        }
        // Skip secondary click
        if (e.which === 3) {
          return
        }
        e.preventDefault()

        var pos = coord(e);
        // change precision
        pos.px = Math.floor(pos.px * 1000) / 1000;
        pos.py = Math.floor(pos.py * 1000) / 1000;
        pos.x = Math.floor(pos.px * element.width);
        pos.y = Math.floor(pos.py * element.height);
        self.cursor = pos;
        markPosition(self.cursor)

        stopMousing()
      }

      function stopMousing() {
        element.removeEventListener('mousemove', mouseMoveListener);
        element.addEventListener('mousemove', mouseHoverListener);
        document.removeEventListener('mouseup', mouseUpListener);
        deactiveFinger(0);
      }

      function coord(event) {
        var e = event;
        if (e.originalEvent) {
          e = e.originalEvent
        }
        calculateBounds()
        var x = e.pageX - screen.bounds.x
        var y = e.pageY - screen.bounds.y
        var px = x / screen.bounds.w;
        var py = y / screen.bounds.h;
        return {
          px: px,
          py: py,
          x: Math.floor(px * element.width),
          y: Math.floor(py * element.height),
        }
      }

      function mouseHoverListener(event) {
        var e = event;
        if (e.originalEvent) {
          e = e.originalEvent
        }
        // Skip secondary click
        if (e.which === 3) {
          return
        }
        e.preventDefault()
        // startMousing()

        var x = e.pageX - screen.bounds.x
        var y = e.pageY - screen.bounds.y
        var pos = coord(event);

        self.drawAllNode()
        if (self.nodeSelected) {
          self.drawNode(self.nodeSelected, "red");
        }
        self.drawHoverNode(pos);
        if (self.cursor.px) {
          markPosition(self.cursor)
        }
      }

      //频幕点击
      function mouseDownListener(event) {
        var e = event;
        if (e.originalEvent) {
          e = e.originalEvent
        }
        // Skip secondary click
        if (e.which === 3) {
          return
        }
        e.preventDefault()

        fakePinch = e.altKey
        calculateBounds()
        // startMousing()

        var x = e.pageX - screen.bounds.x
        var y = e.pageY - screen.bounds.y
        var pressure = 0.5
        activeFinger(0, e.pageX, e.pageY, pressure);

        if (self.nodeHovered) {
          self.nodeSelected = self.nodeHovered;
          self.drawAllNode();
          // self.drawHoverNode(pos);
          self.drawNode(self.nodeSelected, "red");
          var generatedCode = self.generateNodeSelectorCode(self.nodeSelected);
          if (self.autoCopy) {
            copyToClipboard(generatedCode);
          }
          self.generatedCode = generatedCode;
          // self.editor.setValue(generatedCode);

          self.$jstree.jstree("deselect_all");
          self.$jstree.jstree("close_all");
          self.$jstree.jstree("select_node", "#" + self.nodeHovered.id);
          self.$jstree.jstree(true)._open_to("#" + self.nodeHovered.id);
          document.getElementById(self.nodeHovered.id).scrollIntoView(false);
          self.elem=self.nodeSelected
        }
        // self.touchDown(0, x / screen.bounds.w, y / screen.bounds.h, pressure);

        element.removeEventListener('mousemove', mouseHoverListener);
        element.addEventListener('mousemove', mouseMoveListener);
        document.addEventListener('mouseup', mouseUpListener);
      }

      function markPosition(pos) {
        var ctx = self.canvas.fg.getContext("2d");
        ctx.fillStyle = '#ff0000'; // red
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 12, 0, 2 * Math.PI)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = "#fff"; // white
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI)
        ctx.closePath()
        ctx.fill();
      }

      /* bind listeners */
      element.addEventListener('mousedown', mouseDownListener);
      element.addEventListener('mousemove', mouseHoverListener);
    },
    initJstree: function () {
      var $jstree = $("#jstree-hierarchy");
      this.$jstree = $jstree;
      var self = this;
      $jstree.jstree({
        plugins: ["search"],
        core: {
          multiple: false,
          themes: {
            "variant": "small"
          },
          data: []
        }
      })
        .on('ready.jstree refresh.jstree', function () {
          $jstree.jstree("open_all");
        })
        .on("changed.jstree", function (e, data) {
          var id = data.selected[0];
          var node = self.originNodeMaps[id];
          if (node) {
            self.nodeSelected = node;
            self.drawAllNode();
            self.drawNode(node, "red");
            var generatedCode = self.generateNodeSelectorCode(self.nodeSelected);
            if (self.autoCopy) {
              copyToClipboard(generatedCode);
            }
            self.generatedCode = generatedCode;
            self.elem=self.nodeSelected
          }
        })
        .on("hover_node.jstree", function (e, data) {
          var node = self.originNodeMaps[data.node.id];
          if (node) {
            self.nodeHovered = node;
            self.drawRefresh()
          }
        })
        .on("dehover_node.jstree", function () {
          self.nodeHovered = null;
          self.drawRefresh()
        })
      $("#jstree-search").on('propertychange input', function (e) {
        var ret = $jstree.jstree(true).search($(this).val());
      })
    },
    reserveDevice: function () {
      var dtd = $.Deferred();
      var ws = new WebSocket("ws://" + location.host + "/devices/" + this.deviceUdid + "/reserved")
      ws.onmessage = function (message) {
        console.log("WebSocket receive", message)
      }
      var key = setInterval(function () {
        ws.send("ping")
      }, 5000);
      ws.onopen = function () {
        dtd.resolve();
      }
      ws.onerror = function (err) {
        console.log("WebSocket Error " + err)
      }
      ws.onclose = function () {
        dtd.reject();
        clearInterval(key);
        console.log("websocket reserved closed");
      }
      return dtd.promise();
    },
    connectImage2VideoWebSocket: function (fps) {
      var protocol = location.protocol == "http:" ? "ws:" : "wss:";
      var wsURL = protocol + location.host + "/video/convert"
      var wsQueries = encodeURI("fps=" + fps) + "&" + encodeURI("udid=" + this.deviceUdid) + "&" + encodeURI("name=" + this.deviceInfo.model)
      var ws = new WebSocket(wsURL + "?" + wsQueries)
      var def = $.Deferred()
      ws.onopen = function () {
        def.resolve(this)
      }
      ws.onclose = function (ev) {
        def.reject("Somehow ws disconnected")
      }
      return def.promise();
    },
    startLowQualityScreenRecord: function (event) {
      $(event.target).notify("初始化中 ...");
      this.connectImage2VideoWebSocket(2)
        .done(function (ws) {
          $(event.target).notify("视频录制中, 再次点击停止");
          var key = setInterval(function () {
            $.ajax({
              url: this.deviceUrl + "/screenshot/0?thumbnail=800x800",
              method: "get",
              processData: false,
              cache: false,
              xhr: function () {
                var xhr = new XMLHttpRequest();
                xhr.responseType = "blob"
                return xhr;
              },
              success: function (data) {
                ws.send(data)
                console.log("screenshot")
              }
            })
          }.bind(this), 1000)
          this.videoReceiver = {
            ws: ws,
            key: key,
          }
        }.bind(this))
        .fail(function (err) {
          $(event.target).notify("录制启动失败, 请点击【关于我们】，联系网站管理员", "error");
        })
    },
    startVideoRecord: function (event) {
      $(event.target).notify("初始化中 ...");
      this.connectImage2VideoWebSocket(10)
        .done(function (ws) {
          $(event.target).notify("视频录制中, 再次点击停止");
          var cache = {}
          function receiver(_, data) {
            cache.last = data;
          }
          var key = setInterval(function () {
            var lastData = cache.last;
            cache.last = null;
            if (lastData) {
              ws.send(lastData)
            }
          }, 1000 / 6) // fps: 6
          receiver.ws = ws;
          receiver.key = key;

          $.subscribe('imagedata', receiver)
          this.videoReceiver = receiver;
        }.bind(this))
        .fail(function (err) {
          $(event.target).notify("录制启动失败, 请点击【关于我们】，联系网站管理员", "error");
        })
    },
    stopVideoRecord: function () {
      if (this.videoReceiver) {
        $.unsubscribe("imagedata", this.videoReceiver);
        this.videoReceiver.ws.close()
        clearInterval(this.videoReceiver.key);
        this.videoReceiver = null;
        $(event.target).notify("视频录制成功");
      }
    },
    toggleScreen: function () {
      if (this.screenWS) {
        this.screenWS.close();
        this.canvasStyle.opacity = 0;
        this.screenWS = null;
      } else {
        this.openScreenStream();
        this.canvasStyle.opacity = 1;
      }
    },
    saveShortVideo: function (event) {
      var fd = new FormData();
      this.imageBlobBuffer.forEach(function (blob) {
        fd.append('file', blob);
      });
      $(event.target).notify("视频后台合成中，请稍候 ...");
      console.log("upload")
      $.ajax({
        type: "post",
        url: "http://10.246.46.160:7000/img2video", // TODO: 临时地址，需要后期更换
        processData: false,
        contentType: false,
        data: fd,
        dateType: 'json',
      }).done(function (data) {
        console.log(data.url);
        this.videoUrl = data.url;
        $(event.target).notify("合成完毕");
      }.bind(this))
    },
    saveScreenshot: function () {
      $.ajax({
        url: this.deviceUrl + "/screenshot",
        cache: false,
        xhrFields: {
          responseType: 'blob'
        },
      }).then(function (blob) {
        saveAs(blob, "screenshot.jpg") // saveAs require FileSaver.js
      })
    },
    openBrowser: function (url) {
      if (!/^https?:\/\//.test(url)) {
        url = "http://" + url;
      }
      return this.shell("am start -a android.intent.action.VIEW -d " + url);
    },
    uploadFile: function (event) {
      var formData = new FormData(event.target);
      $(event.target).notify("Uploading ...");
      $.ajax({
        method: "post",
        url: this.deviceUrl + "/upload/sdcard/tmp/",
        data: formData,
        processData: false,
        contentType: false,
        enctype: 'multipart/form-data',
      }).then(function (ret) {
          $(event.target).notify("Upload success");
        }, function (err) {
          $(event.target).notify("Upload failed:" + err.responseText, "error")
          console.error(err)
        })
    },
    addTabItem: function (item) {
      this.navtabs.tabs.push(item);
    },
    changeTab: function (tabId) {
      location.hash = tabId;
    },
    fixRotation: function () {
      $.ajax({
        url: this.deviceUrl + "/info/rotation",
        method: "post",
      }).then(function (ret) {
        console.log("rotation fixed")
      })
    },
    fixMinicap: function () {
      this.fixConsole = "remove old minicap";
      $.ajax({
        method: "post",
        url: this.deviceUrl + "/shell",
        data: {
          command: "rm -f /data/local/tmp/minicap /data/local/tmp/minicap.so"
        }
      })
        .then(function () {
          this.fixConsole = "download mincap to device ..."
          return $.ajax({
            url: this.deviceUrl + "/minicap",
            method: "put",
          })
        }.bind(this))
        .then(function () {
          this.fixConsole = "minicap fixed"
        }.bind(this), function () {
          this.fixConsole = "minicap can not be fixed, open Browser Console for more detail"
        }.bind(this))
    },
    tabScroll: function (ev) {
      // var el = ev.target;
      // var el = this.$refs.tab_content;
      // var bottom = (el.scrollTop == (el.scrollHeight - el.clientHeight));
      // console.log("Bottom", bottom, el.scrollTop, el.scrollHeight, el.clientHeight, el.scrollHeight - el.clientHeight)
      // console.log(ev.target.scrollTop, ev.target.scrollHeight, ev.target.clientHeight);
      this.logcat.follow = false;
    },
    followLog: function () {
      this.logcat.follow = !this.logcat.follow;
      if (this.logcat.follow) {
        var el = this.$refs.tab_content;
        el.scrollTop = el.scrollHeight - el.clientHeight;
      }
    },
    logcatTag2Color: function (tag) {
      var color = this.logcat.tagColors[tag];
      if (!color) {
        color = this.logcat.tagColors[tag] = getRandomRgb(5);
      }
      return color;
    },
    logcatLevel2Color: function (level) {
      switch (level) {
        case "W":
          return "goldenrod";
        case "I":
          return "darkgreen";
        case "D":
          return "gray";
        default:
          return "gray";
      }
    },
    hold: function (msecs) {
      this.control.touchDown(0, 0.5, 0.5, 5, 0.5)
      this.control.touchCommit();
      this.control.touchWait(msecs);
      this.control.touchUp(0)
      this.control.touchCommit();
    },
    keyevent: function (meta) {
      console.log("keyevent", meta)
      return this.shell("input keyevent " + meta.toUpperCase());
    },
    shell: function (command) {
      return $.ajax({
        url: this.deviceUrl + "/shell",
        method: "post",
        data: {
          command: command,
        },
        success: function (ret) {
          console.log(ret);
        },
        error: function (ret) {
          console.log(ret)
        }
      })
    },
    showError: function (error) {
      this.loading = false;
      this.error = error;
      $('.modal').modal('show');
    },
    showAjaxError: function (ret) {
      if (ret.responseJSON && ret.responseJSON.description) {
        this.showError(ret.responseJSON.description);
      } else {
        this.showError("<p>Local server not started, start with</p><pre>$ python -m weditor</pre>");
      }
    },
    //左边屏幕移动
    initDragDealer: function () {
      var self = this;
      var updateFunc = null;

      function dragMoveListener(evt) {
        evt.preventDefault();
        updateFunc(evt);
        self.resizeScreen();
      }

      function dragStopListener(evt) {
        document.removeEventListener('mousemove', dragMoveListener);
        document.removeEventListener('mouseup', dragStopListener);
        document.removeEventListener('mouseleave', dragStopListener);
      }

      $('#vertical-gap1').mousedown(function (e) {
        e.preventDefault();
        updateFunc = function (evt) {
          $("#left").width(evt.clientX);
        };
        document.addEventListener('mousemove', dragMoveListener);
        document.addEventListener('mouseup', dragStopListener);
        document.addEventListener('mouseleave', dragStopListener)
      });
    },
    resizeScreen: function (img) {
      // check if need update
      if (img) {
        if (this.lastScreenSize.canvas.width == img.width &&
          this.lastScreenSize.canvas.height == img.height) {
          return;
        }
      } else {
        img = this.lastScreenSize.canvas;
        if (!img) {
          return;
        }
      }
      var screenDiv = document.getElementById('screen');
      this.lastScreenSize = {
        canvas: {
          width: img.width,
          height: img.height
        },
        screen: {
          width: screenDiv.clientWidth,
          height: screenDiv.clientHeight,
        }
      }

      var screenDiv = document.getElementById('screen');
      this.lastScreenSize = {
        canvas: {
          width: img.width,
          height: img.height
        },
        screen: {
          width: screenDiv.clientWidth,
          height: screenDiv.clientHeight,
        }
      }


      var canvasAspect = img.width / img.height;
      var screenAspect = screenDiv.clientWidth / screenDiv.clientHeight;
      if (canvasAspect > screenAspect) {
        Object.assign(this.canvasStyle, {
          width: Math.floor(screenDiv.clientWidth) + 'px', //'100%',
          height: Math.floor(screenDiv.clientWidth / canvasAspect) + 'px', // 'inherit',
        })
      } else if (canvasAspect < screenAspect) {
        Object.assign(this.canvasStyle, {
          width: Math.floor(screenDiv.clientHeight * canvasAspect) + 'px', //'inherit',
          height: Math.floor(screenDiv.clientHeight) + 'px', //'100%',
        })
      }
    },

    resizeScreenTree: function (img) {
      // check if need update
      if (img) {
        if (this.lastScreenSize.canvas.width == img.width &&
          this.lastScreenSize.canvas.height == img.height) {
          return;
        }
      } else {
        img = this.lastScreenSize.canvas;
        if (!img) {
          return;
        }
      }
      var screenDiv = document.getElementById('screen_tree');
      this.lastScreenSize = {
        canvas: {
          width: img.width,
          height: img.height
        },
        screen: {
          width: screenDiv.clientWidth,
          height: screenDiv.clientHeight,
        }
      }

      var screenDiv = document.getElementById('screen_tree');
      this.lastScreenSize = {
        canvas: {
          width: img.width,
          height: img.height
        },
        screen: {
          width: screenDiv.clientWidth,
          height: screenDiv.clientHeight,
        }
      }


      var canvasAspect = img.width / img.height;
      var screenAspect = screenDiv.clientWidth / screenDiv.clientHeight;
      if (canvasAspect > screenAspect) {
        Object.assign(this.canvasStyleTree, {
          width: Math.floor(screenDiv.clientWidth) + 'px', //'100%',
          height: Math.floor(screenDiv.clientWidth / canvasAspect) + 'px', // 'inherit',
        })
      } else if (canvasAspect < screenAspect) {
        Object.assign(this.canvasStyleTree, {
          width: Math.floor(screenDiv.clientHeight * canvasAspect) + 'px', //'inherit',
          height: Math.floor(screenDiv.clientHeight) + 'px', //'100%',
        })
      }
    },

    delayReload: function (msec) {
      setTimeout(this.screenDumpUI, msec || 1000);
    },
    openScreenStream: function () {
      var self = this;
      var BLANK_IMG =
        'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
      var protocol = location.protocol == "http:" ? "ws://" : "wss://"
      var ws = new WebSocket(this.deviceUrl.replace("http:", "ws:") + '/minicap');
      var canvas = document.getElementById('bgCanvas')
      var ctx = canvas.getContext('2d');
      var lastScreenSize = {
        screen: {},
        canvas: {}
      };

      this.screenWS = ws;
      var imagePool = new ImagePool(100);

      ws.onopen = function (ev) {
        console.log('screen websocket connected')
      };

      // FIXME(ssx): use pubsub is better
      var imageBlobBuffer = self.imageBlobBuffer;
      var imageBlobMaxLength = 300;

      ws.onmessage = function (message) {
        if (message.data instanceof Blob) {
          $.publish("imagedata", message.data);

          var blob = new Blob([message.data], {
            type: 'image/jpeg'
          })

          imageBlobBuffer.push(blob);

          if (imageBlobBuffer.length > imageBlobMaxLength) {
            imageBlobBuffer.shift();
          }

          var img = imagePool.next();
          img.onload = function () {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, img.width, img.height);
            self.resizeScreen(img);


            // Try to forcefully clean everything to get rid of memory
            // leaks. Note self despite this effort, Chrome will still
            // leak huge amounts of memory when the developer tools are
            // open, probably to save the resources for inspection. When
            // the developer tools are closed no memory is leaked.
            img.onload = img.onerror = null;
            img.src = BLANK_IMG;
            img = null;
            blob = null;

            URL.revokeObjectURL(url);
            url = null
          };

          img.onerror = function () {
            // Happily ignore. I suppose this shouldn't happen, but
            // sometimes it does, presumably when we're loading images
            // too quickly.

            // Do the same cleanup here as in onload.
            img.onload = img.onerror = null;
            img.src = BLANK_IMG;
            img = null;
            blob = null;

            URL.revokeObjectURL(url);
            url = null;
          };

          var url = URL.createObjectURL(blob);
          img.src = url;
          window.app.loading = false;
        } else if (/^data size:/.test(message.data)) {
          // console.log("receive message:", message.data)
        } else if (/^rotation/.test(message.data)) {
          self.rotation = parseInt(message.data.substr('rotation '.length), 10);
          console.log("这个是啥",self.rotation)
        } else {
          console.log("receive message:", message.data)
        }
      }

      ws.onclose = function (ev) {
        console.log("screen websocket closed", ev.code)
      }.bind(this)

      ws.onerror = function (ev) {
        console.log("screen websocket error")
      }
    },
    enableTouch: function () {
      /**
       * TOUCH HANDLING
       */
      var self = this;
      var element = this.canvas.fg;

      var screen = {
        bounds: {}
      }

      var ws = new WebSocket(this.deviceUrl.replace("http:", "ws:") + "/minitouch")
      ws.onerror = function (ev) {
        console.log("minitouch websocket error:", ev)
      }
      ws.onmessage = function (ev) {
        console.log("minitouch websocket receive message:", ev.data);
      }
      ws.onclose = function () {
        console.log("minitouch websocket closed");
      }
      var control = this.control = MiniTouch.createNew(ws);

      function calculateBounds() {
        var el = element;
        screen.bounds.w = el.offsetWidth
        screen.bounds.h = el.offsetHeight
        screen.bounds.x = 0
        screen.bounds.y = 0

        while (el.offsetParent) {
          screen.bounds.x += el.offsetLeft
          screen.bounds.y += el.offsetTop
          el = el.offsetParent
        }
      }

      function activeFinger(index, x, y, pressure) {
        var scale = 0.5 + pressure
        $(".finger-" + index)
          .addClass("active")
          .css("transform", 'translate3d(' + x + 'px,' + y + 'px,0)')
      }

      function deactiveFinger(index) {
        $(".finger-" + index).removeClass("active")
      }

      function mouseDownListener(event, type) {
        var e = event;
        if (e.originalEvent) {
          e = e.originalEvent
        }
        // Skip secondary click
        if (e.which === 3) {
          return
        }
        e.preventDefault();

        fakePinch = e.altKey;
        calculateBounds();
        var x, y, pageX, pageY;
        var pressure = 0.5
        if (type == "touchstart"){
            x = e.targetTouches[0].pageX - screen.bounds.x;
            y = e.targetTouches[0].pageY - screen.bounds.y;
            pageX = e.targetTouches[0].pageX;
            pageY = e.targetTouches[0].pageY;
            element.removeEventListener('touchmove', mouseHoverListener);
            element.addEventListener('touchmove', touchMoveListener);
        }else{
            x = e.pageX - screen.bounds.x;
            y = e.pageY - screen.bounds.y;
            pageX = e.pageX;
            pageY = e.pageY;
            element.removeEventListener('mousemove', mouseHoverListener);
            element.addEventListener('mousemove', mouseMoveListener);
        }

        activeFinger(0, pageX, pageY, pressure);
        //计算点击坐标
        var scaled = coords(screen.bounds.w, screen.bounds.h, x, y, self.rotation);
        console.log(scaled);
        control.touchDown(0, scaled.xP, scaled.yP, pressure);
        control.touchCommit();

        document.addEventListener('mouseup', mouseUpListener);
      }

      function touchMoveListener(event) {

        var e = event;
        if (e.originalEvent) {
          e = e.originalEvent
        }
        // Skip secondary click
        if (e.which === 3) {
          return
        }
        e.preventDefault();
        var pressure = 0.5;
        activeFinger(0, e.targetTouches[0].pageX, e.targetTouches[0].pageY, pressure);

        var x = e.targetTouches[0].pageX - screen.bounds.x;
        var y = e.targetTouches[0].pageY - screen.bounds.y;
        var scaled = coords(screen.bounds.w, screen.bounds.h, x, y, self.rotation);
        console.log(x,y, scaled, self.rotation);
        control.touchMove(0, scaled.xP, scaled.yP, pressure);
        control.touchCommit();
        document.addEventListener('touchend', mouseUpListener);
      }

      function mouseMoveListener(event) {
        var e = event;
        if (e.originalEvent) {
          e = e.originalEvent
        }
        // Skip secondary click
        if (e.which === 3) {
          return
        }
        e.preventDefault();
        var pressure = 0.5;
        activeFinger(0, e.pageX, e.pageY, pressure);
        var x = e.pageX - screen.bounds.x
        var y = e.pageY - screen.bounds.y
        var scaled = coords(screen.bounds.w, screen.bounds.h, x, y, self.rotation);
        console.log(x,y, scaled, self.rotation);
        control.touchMove(0, scaled.xP, scaled.yP, pressure);
        control.touchCommit();
      }

      function mouseUpListener(event) {
        var e = event
        if (e.originalEvent) {
          e = e.originalEvent
        }
        // Skip secondary click
        if (e.which === 3) {
          return
        }
        e.preventDefault()

        control.touchUp(0)
        control.touchCommit();
        stopMousing()
      }

      function stopMousing() {
        element.removeEventListener('mousemove', mouseMoveListener);
        // element.addEventListener('mousemove', mouseHoverListener);
        document.removeEventListener('mouseup', mouseUpListener);
        deactiveFinger(0);
      }

      function mouseHoverListener(event) {
        var e = event;
        if (e.originalEvent) {
          e = e.originalEvent
        }
        // Skip secondary click
        if (e.which === 3) {
          return
        }
        e.preventDefault()

        var x = e.pageX - screen.bounds.x
        var y = e.pageY - screen.bounds.y
      }

      var wheelTimer, fromYP;

      function mouseWheelDelayTouchUp() {
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(function () {
          fromYP = null;
          control.touchUp(1)
          control.touchCommit();
          // deactiveFinger(0);
          // deactiveFinger(1);
        }, 100)
      }

      function mouseWheelListener(event) {
        var e = event;
        if (e.originalEvent) {
          e = e.originalEvent
        }
        e.preventDefault()
        calculateBounds()

        var x = e.pageX - screen.bounds.x
        var y = e.pageY - screen.bounds.y
        var pressure = 0.5;
        var scaled;

        if (!fromYP) {
          fromYP = y / screen.bounds.h; // display Y percent
          // touch down when first detect mousewheel
          scaled = coords(screen.bounds.w, screen.bounds.h, x, y, self.rotation);
          control.touchDown(1, scaled.xP, scaled.yP, pressure);
          control.touchCommit();
          // activeFinger(0, e.pageX, e.pageY, pressure);
        }
        // caculate position after scroll
        var toYP = fromYP + (event.wheelDeltaY < 0 ? -0.05 : 0.05);
        toYP = Math.max(0, Math.min(1, toYP));

        var step = Math.max((toYP - fromYP) / 5, 0.01) * (event.wheelDeltaY < 0 ? -1 : 1);
        for (var yP = fromYP; yP < 1 && yP > 0 && Math.abs(yP - toYP) > 0.0001; yP += step) {
          y = screen.bounds.h * yP;
          var pageY = y + screen.bounds.y;
          scaled = coords(screen.bounds.w, screen.bounds.h, x, y, self.rotation);
          // activeFinger(1, e.pageX, pageY, pressure);
          control.touchMove(1, scaled.xP, scaled.yP, pressure);
          control.touchWait(10);
          control.touchCommit();
        }
        fromYP = toYP;
        mouseWheelDelayTouchUp()
      }
      // TODO  优化 支持手机浏览器手势
      /* bind listeners */
      element.addEventListener('mousedown', function (){mouseDownListener(event,"mousedown")});
      element.addEventListener('touchstart', function (){mouseDownListener(event,"touchstart")});
    },
    refreshTopApp() {
            this.runShell("dumpsys activity top").then(ret => {
              const reActivity = String.raw`\s*ACTIVITY ([A-Za-z0-9_.]+)\/([A-Za-z0-9_.]+) \w+ pid=(\d+)`
              let matches = ret.output.match(new RegExp(reActivity, "g"))
              if (matches.length > 0) {
                let m = matches.pop().match(new RegExp(reActivity))
                this.topApp.packageName = m[1];
                this.topApp.activity = m[2]
                this.topApp.pid = m[3]
              }
            })
    },
    addTopAppToShortcut() {
      this.$prompt('给 <code>' + this.topApp.packageName + '</code> 起个名字', '快捷方式添加', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        dangerouslyUseHTMLString: true,
      }).then(({ value }) => {
        let command = ["monkey", "-p", this.topApp.packageName, "-c", "android.intent.category.LAUNCHER", "1"].join(" ")
        this.addShortcut(value, command)
      }).catch(() => {
      })
    },
    atxAgentManager(v){
      $.ajax({
        type: "get",
        url: "/atxagent",
        data: {
          "method": v,
          "udid": deviceUdid
        },
        dataType: "json",
        success: function (data) {
           console.log(data)
        },
        error:function (data) {
          console.log(data);
          if(data.status == 200){
            toastr.success(data.responseText)
          }else{
            toastr.error(data.responseText)
          }

        }
      })
    }
  }
})
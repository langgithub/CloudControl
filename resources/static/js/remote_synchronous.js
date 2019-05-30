/* Javascript */
window.app = new Vue({
    el: '#app',
    data: {
        deviceIp: deviceIp,
        deviceList: [],
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
        control_list:[],
        loading: false,
        canvas: {
            bg: null,
            fg: null,
        },
        canvasStyle: {
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
        //用于记录不是抓窗口视图参数
        lastScreenSize2: {
            screen: {},
            canvas: {
                width: 1,
                height: 1
            }
        },
        screenWS: [],
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
    },
    watch: {},
    computed: {
        deviceUrl: function () {
            return "http://" + this.device.ip + ":" + this.device.port;
        }
    },
    mounted: function () {
        // this.deviceList=window.deviceList;
        for(var i=0;i<deviceList.length;i++){
            this.deviceList.push({src:"http://"+deviceList[i]["src"]+":7912/screenshot",
                des:deviceList[i]["src"],remote:"/devices/"+deviceList[i]["udid"]+"/remote"})
        }

        var self = this;
        $.notify.defaults({ className: "success" });
        this.canvas.bg = document.getElementById('bgCanvas0')
        this.canvas.fg = document.getElementById('fgCanvas')


        $(window).resize(function () {
            self.resizeScreen();
        })

        this.initDragDealer();

        // get device info
        $.ajax({
            url: this.deviceUrl + "/info", // "/devices/" + this.deviceUdid + "/info",
            dateType: "json"
        }).then(function (ret) {
            this.deviceInfo = ret;
            document.title = ret.model;
        }.bind(this));
        this.enableTouch();
        this.openScreenStream();

        // wakeup device on connect
        setTimeout(function () {
            this.keyevent("WAKEUP");
        }.bind(this), 1)


    },
    watch: {
        inputText: function (newText) {
            console.log(newText);
            this.inputWS.send(JSON.stringify({ type: "InputEdit", text: newText }))
        }
    },
    methods: {

        toggleScreen: function () {
            for(var i=0;i<this.screenWS.length;i++){
                if (this.screenWS[i] && i == 0) {
                    this.screenWS[i].close();
                    this.canvasStyle.opacity = 0;
                    this.screenWS.splice(i);
                } else if(this.screenWS[i] && i != 0){
                    this.screenWS[i].close();
                    this.screenWS.splice(i);
                }
                else{
                    this.openScreenStream();
                    this.canvasStyle.opacity = 1;
                }
            }
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
        tabScroll: function (ev) {
            // var el = ev.target;
            // var el = this.$refs.tab_content;
            // var bottom = (el.scrollTop == (el.scrollHeight - el.clientHeight));
            // console.log("Bottom", bottom, el.scrollTop, el.scrollHeight, el.clientHeight, el.scrollHeight - el.clientHeight)
            // console.log(ev.target.scrollTop, ev.target.scrollHeight, ev.target.clientHeight);
            this.logcat.follow = false;
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
            $.ajax({
                url: "/devices/shell/input keyevent " + meta.toUpperCase()+ "?list=" + JSON.stringify(deviceList),
                method: "get"
            })
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
                }
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
        delayReload: function (msec) {
            setTimeout(this.screenDumpUI, msec || 1000);
        },
        //老版本画布
        // openScreenStream: function () {
        //     var self = this;
        //     var BLANK_IMG =
        //         'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
        //     var protocol = location.protocol == "http:" ? "ws://" : "wss://"
        //     for (var i=0;i<this.deviceList.length;i++) {
        //
        //         var canvas = document.getElementById('bgCanvas' + i)
        //         var ctx = canvas.getContext('2d')
        //
        //         this.screenWS[i] = {
        //             ws: new WebSocket("ws://"+ this.deviceList[i].src + ":"+ this.deviceList[i].port  + '/minicap'),
        //             canvas: canvas,
        //             ctx: ctx,
        //             imageBlobBuffer: []
        //         }
        //
        //         this.screenWS[i].ws.onopen = function (ev) {
        //             console.log('screen websocket connected')
        //         };
        //
        //         // FIXME(ssx): use pubsub is better
        //         this.screenWS[i].ws.screenWS = this.screenWS[i]
        //         this.screenWS[i].ws.screenWS.imageBlobBuffer = this.screenWS[i].imageBlobBuffer
        //         this.screenWS[i].ws.screenWS.imageBlobMaxLength = 3000
        //         this.screenWS[i].ws.screenWS.imagePool = new ImagePool(3000)
        //
        //
        //         this.screenWS[i].ws.onmessage = function (message) {
        //             if (message.data instanceof Blob) {
        //                 // console.log("image received");
        //                 $.publish("imagedata", message.data);
        //
        //                 var blob = new Blob([message.data], {
        //                     type: 'image/jpeg'
        //                 })
        //
        //                 this.screenWS.imageBlobBuffer.push(blob);
        //
        //                 if (this.screenWS.imageBlobBuffer.length > this.screenWS.imageBlobMaxLength) {
        //                     this.screenWS.imageBlobBuffer.shift();
        //                 }
        //                 this.screenWS.img = this.screenWS.imagePool.next();
        //
        //                 this.screenWS.img.screenWS = this.screenWS
        //                 this.screenWS.img.onload = function () {
        //                     //如果不是主操作界面
        //                     if(this.screenWS.canvas.id !="bgCanvas0"){
        //                         this.width = this.screenWS.canvas.width
        //                         this.height = this.screenWS.canvas.height
        //                         console.log(message.currentTarget.url + "  image" + this.width + " " + this.height)
        //                         this.screenWS.ctx.drawImage(this, 0, 0, this.width, this.height);
        //                         //还原图片宽高
        //                         this.width = 400
        //                         this.height = 800
        //                     }else{
        //                         this.screenWS.canvas.width = this.width
        //                         this.screenWS.canvas.height = this.height
        //                         console.log(message.currentTarget.url + "  image" + this.width + " " + this.height)
        //                         this.screenWS.ctx.drawImage(this, 0, 0, this.width, this.height);
        //                         self.resizeScreen(this);
        //                     }
        //
        //                     // Try to forcefully clean everything to get rid of memory
        //                     // leaks. Note self despite this effort, Chrome will still
        //                     // leak huge amounts of memory when the developer tools are
        //                     // open, probably to save the resources for inspection. When
        //                     // the developer tools are closed no memory is leaked.
        //                     this.onload = this.onerror = null
        //                     this.src = BLANK_IMG
        //                     this.screenWS.img = null
        //                     blob = null
        //                     URL.revokeObjectURL(url)
        //                     url = null
        //                 }
        //
        //                 this.screenWS.img.onerror = function () {
        //                     // Happily ignore. I suppose this shouldn't happen, but
        //                     // sometimes it does, presumably when we're loading images
        //                     // too quickly.
        //
        //                     // Do the same cleanup here as in onload.
        //                     this.onload = this.onerror = null
        //                     this.src = BLANK_IMG
        //                     this.screenWS.img = null
        //                     blob = null
        //
        //                     URL.revokeObjectURL(url)
        //                     url = null
        //                 }
        //
        //                 var url = URL.createObjectURL(blob)
        //                 this.screenWS.img.src = url;
        //             } else if (/^data size:/.test(message.data)) {
        //                 // console.log("receive message:", message.data)
        //             } else if (/^rotation/.test(message.data)) {
        //                 self.rotation = parseInt(message.data.substr('rotation '.length), 10);
        //                 console.log(self.rotation)
        //             } else {
        //                 console.log("receive message:", message.data)
        //             }
        //         }
        //
        //         this.screenWS[i].ws.onclose = function (ev) {
        //             console.log("screen websocket closed", ev.code)
        //         }.bind(this)
        //
        //         this.screenWS[i].ws.onerror = function (ev) {
        //             console.log("screen websocket error")
        //         }
        //     }
        //
        // },
        openScreenStream: function () {
          var self = this;
          var BLANK_IMG =
            'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
          var ws = new WebSocket(this.deviceUrl.replace("http:", "ws:") + '/minicap');
          var canvas = document.getElementById('bgCanvas0')
          var ctx = canvas.getContext('2d');

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
              console.log("image received");
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
                canvas.width = img.width
                canvas.height = img.height
                ctx.drawImage(img, 0, 0, img.width, img.height);
                self.resizeScreen(img);


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
              }

              var url = URL.createObjectURL(blob)
              img.src = url;
            } else if (/^data size:/.test(message.data)) {
              // console.log("receive message:", message.data)
            } else if (/^rotation/.test(message.data)) {
              self.rotation = parseInt(message.data.substr('rotation '.length), 10);
              console.log(self.rotation)
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
        // TODO 更改为minitouch版本
        // enableTouch: function () {
        //     /**
        //      * TOUCH HANDLING
        //      */
        //     var self = this;
        //     var element = this.canvas.bg;
        //
        //     var screen = {
        //         bounds: {}
        //     }
        //
        //     //主屏幕
        //     var ws = new WebSocket(this.deviceUrl.replace("http:", "ws:") + "/minitouch")
        //     ws.onerror = function (ev) {
        //         console.log("minitouch websocket error:", ev)
        //     }
        //     ws.onmessage = function (ev) {
        //         console.log("minitouch websocket receive message:", ev.data);
        //     }
        //     ws.onclose = function () {
        //         console.log("minitouch websocket closed");
        //     }
        //     this.control_list[0] = MiniTouch.createNew(ws);
        //
        //     //其他频幕
        //     var ws_all = new WebSocket("ws://"+window.location.host+"/minitouch_all")
        //     ws_all.onerror = function (ev) {
        //         console.log("minitouch websocket error:", ev)
        //     }
        //     ws_all.onmessage = function (ev) {
        //         console.log("minitouch websocket receive message:", ev.data);
        //     }
        //     ws_all.onclose = function () {
        //         console.log("minitouch websocket closed");
        //     }
        //     this.control_list[1] = MiniTouch.createNew(ws_all);
        //
        //
        //     var control = this.control_list
        //     function calculateBounds() {
        //         var el = element;
        //         screen.bounds.w = el.offsetWidth
        //         screen.bounds.h = el.offsetHeight
        //         screen.bounds.x = 0
        //         screen.bounds.y = 0
        //
        //         while (el.offsetParent) {
        //             screen.bounds.x += el.offsetLeft
        //             screen.bounds.y += el.offsetTop
        //             el = el.offsetParent
        //         }
        //     }
        //
        //     function activeFinger(index, x, y, pressure) {
        //         var scale = 0.5 + pressure
        //         $(".finger-" + index)
        //             .addClass("active")
        //             .css("transform", 'translate3d(' + x + 'px,' + y + 'px,0)')
        //     }
        //
        //     function deactiveFinger(index) {
        //         $(".finger-" + index).removeClass("active")
        //     }
        //
        //     function mouseDownListener(event) {
        //         var e = event;
        //         if (e.originalEvent) {
        //             e = e.originalEvent
        //         }
        //         // Skip secondary click
        //         if (e.which === 3) {
        //             return
        //         }
        //         e.preventDefault()
        //
        //         fakePinch = e.altKey
        //         calculateBounds()
        //
        //         var x = e.pageX - screen.bounds.x
        //         var y = e.pageY - screen.bounds.y
        //         var pressure = 0.5
        //         activeFinger(0, e.pageX, e.pageY, pressure);
        //
        //         var scaled = coords(screen.bounds.w, screen.bounds.h, x, y, self.rotation);
        //         for(var i=0;i<control.length;i++){
        //             control[i].touchDown(0, scaled.xP, scaled.yP, pressure);
        //             control[i].touchCommit();
        //         }
        //
        //
        //         element.removeEventListener('mousemove', mouseHoverListener);
        //         element.addEventListener('mousemove', mouseMoveListener);
        //         document.addEventListener('mouseup', mouseUpListener);
        //         console.log("mouseDownListener end")
        //     }
        //
        //     function mouseMoveListener(event) {
        //         var e = event
        //         if (e.originalEvent) {
        //             e = e.originalEvent
        //         }
        //         // Skip secondary click
        //         if (e.which === 3) {
        //             return
        //         }
        //         e.preventDefault()
        //
        //         var pressure = 0.5
        //         activeFinger(0, e.pageX, e.pageY, pressure);
        //         var x = e.pageX - screen.bounds.x
        //         var y = e.pageY - screen.bounds.y
        //         var scaled = coords(screen.bounds.w, screen.bounds.h, x, y, self.rotation);
        //         for(var i=0;i<control.length;i++) {
        //             control[i].touchMove(0, scaled.xP, scaled.yP, pressure);
        //             control[i].touchCommit();
        //         }
        //         console.log("mouseMoveListener end")
        //     }
        //
        //     function mouseUpListener(event) {
        //         var e = event
        //         if (e.originalEvent) {
        //             e = e.originalEvent
        //         }
        //         // Skip secondary click
        //         if (e.which === 3) {
        //             return
        //         }
        //         e.preventDefault()
        //         for(var i=0;i<control.length;i++){
        //             control[i].touchUp(0)
        //             control[i].touchCommit();
        //             stopMousing()
        //         }
        //         console.log("mouseUpListener end")
        //         window.refersh()
        //         console.log("refersh img")
        //     }
        //
        //     function stopMousing() {
        //         element.removeEventListener('mousemove', mouseMoveListener);
        //         // element.addEventListener('mousemove', mouseHoverListener);
        //         document.removeEventListener('mouseup', mouseUpListener);
        //         deactiveFinger(0);
        //     }
        //
        //     function mouseHoverListener(event) {
        //         var e = event;
        //         if (e.originalEvent) {
        //             e = e.originalEvent
        //         }
        //         // Skip secondary click
        //         if (e.which === 3) {
        //             return
        //         }
        //         e.preventDefault()
        //
        //         var x = e.pageX - screen.bounds.x
        //         var y = e.pageY - screen.bounds.y
        //     }
        //
        //     function markPosition(pos) {
        //         var ctx = self.canvas.fg.getContext("2d");
        //         ctx.fillStyle = '#ff0000'; // red
        //         ctx.beginPath()
        //         ctx.arc(pos.x, pos.y, 12, 0, 2 * Math.PI)
        //         ctx.closePath()
        //         ctx.fill()
        //
        //         ctx.fillStyle = "#fff"; // white
        //         ctx.beginPath()
        //         ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI)
        //         ctx.closePath()
        //         ctx.fill();
        //     }
        //
        //     var wheelTimer, fromYP;
        //
        //     function mouseWheelDelayTouchUp() {
        //         clearTimeout(wheelTimer);
        //         wheelTimer = setTimeout(function () {
        //             fromYP = null;
        //             for(var i=0;i<control.length;i++) {
        //                 control[i].touchUp(1)
        //                 control[i].touchCommit();
        //             }
        //             // deactiveFinger(0);
        //             // deactiveFinger(1);
        //         }, 100)
        //     }
        //
        //     function mouseWheelListener(event) {
        //         var e = event;
        //         if (e.originalEvent) {
        //             e = e.originalEvent
        //         }
        //         e.preventDefault()
        //         calculateBounds()
        //
        //         var x = e.pageX - screen.bounds.x
        //         var y = e.pageY - screen.bounds.y
        //         var pressure = 0.5;
        //         var scaled;
        //
        //         if (!fromYP) {
        //             fromYP = y / screen.bounds.h; // display Y percent
        //             // touch down when first detect mousewheel
        //             scaled = coords(screen.bounds.w, screen.bounds.h, x, y, self.rotation);
        //             for(var i=0;i<control.length;i++) {
        //                 control[i].touchDown(1, scaled.xP, scaled.yP, pressure);
        //                 control[i].touchCommit();
        //             }
        //             // activeFinger(0, e.pageX, e.pageY, pressure);
        //         }
        //         // caculate position after scroll
        //         var toYP = fromYP + (event.wheelDeltaY < 0 ? -0.05 : 0.05);
        //         toYP = Math.max(0, Math.min(1, toYP));
        //
        //         var step = Math.max((toYP - fromYP) / 5, 0.01) * (event.wheelDeltaY < 0 ? -1 : 1);
        //         for (var yP = fromYP; yP < 1 && yP > 0 && Math.abs(yP - toYP) > 0.0001; yP += step) {
        //             y = screen.bounds.h * yP;
        //             var pageY = y + screen.bounds.y;
        //             scaled = coords(screen.bounds.w, screen.bounds.h, x, y, self.rotation);
        //             // activeFinger(1, e.pageX, pageY, pressure);
        //             for(var i=0;i<control.length;i++) {
        //                 control[i].touchMove(1, scaled.xP, scaled.yP, pressure);
        //                 control[i].touchWait(10);
        //                 control[i].touchCommit();
        //             }
        //         }
        //         fromYP = toYP;
        //         mouseWheelDelayTouchUp()
        //         console.log("mouseWheelListener end")
        //     }
        //
        //     /* bind listeners */
        //     element.addEventListener('mousedown', mouseDownListener);
        //     element.addEventListener('mousemove', mouseHoverListener);
        //     element.addEventListener('mousewheel', mouseWheelListener);
        // }
        enableTouch: function () {
            /**
             * TOUCH HANDLING
             */
            var self = this;
            var element = this.canvas.bg;

            // var canvas = document.getElementById('bgCanvas0')

            var screen = {
                bounds: {}
            }
            //单台设备操控多台设备
            for (var i=0;i<deviceList.length;i++) {
                var ws = new WebSocket("ws://" + deviceList[i].src + ":" + deviceList[i].port + "/minitouch")
                ws.onerror = function (ev) {
                    console.log("minitouch websocket error:", ev)
                }
                ws.onmessage = function (ev) {
                    console.log("minitouch websocket receive message:", ev.data);
                }
                ws.onclose = function () {
                    console.log("minitouch websocket closed");
                }
                this.control_list[i] = MiniTouch.createNew(ws);
            }


            var control = this.control_list
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

                var x = e.pageX - screen.bounds.x
                var y = e.pageY - screen.bounds.y
                var pressure = 0.5
                activeFinger(0, e.pageX, e.pageY, pressure);

                var scaled = coords(screen.bounds.w, screen.bounds.h, x, y, self.rotation);
                for(var i=0;i<control.length;i++){
                    control[i].touchDown(0, scaled.xP, scaled.yP, pressure);
                    control[i].touchCommit();
                }


                element.removeEventListener('mousemove', mouseHoverListener);
                element.addEventListener('mousemove', mouseMoveListener);
                document.addEventListener('mouseup', mouseUpListener);
                console.log("mouseDownListener end")
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
                var x = e.pageX - screen.bounds.x
                var y = e.pageY - screen.bounds.y
                var scaled = coords(screen.bounds.w, screen.bounds.h, x, y, self.rotation);
                for(var i=0;i<control.length;i++) {
                    control[i].touchMove(0, scaled.xP, scaled.yP, pressure);
                    control[i].touchCommit();
                }
                console.log("mouseMoveListener end")
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
                for(var i=0;i<control.length;i++){
                    control[i].touchUp(0)
                    control[i].touchCommit();
                    stopMousing()
                }
                var pos = coord(e);
                // change precision
                pos.px = Math.floor(pos.px * 1000) / 1000;
                pos.py = Math.floor(pos.py * 1000) / 1000;
                pos.x = Math.floor(pos.px * element.width);
                pos.y = Math.floor(pos.py * element.height);
                self.cursor = pos;
                markPosition(self.cursor)
                console.log("mouseUpListener end")
                window.refersh()
                console.log("refersh img")
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

                if (self.cursor.px) {
                  markPosition(self.cursor)
                }
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

            var wheelTimer, fromYP;

            function mouseWheelDelayTouchUp() {
                clearTimeout(wheelTimer);
                wheelTimer = setTimeout(function () {
                    fromYP = null;
                    for(var i=0;i<control.length;i++) {
                        control[i].touchUp(1)
                        control[i].touchCommit();
                    }
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
                    for(var i=0;i<control.length;i++) {
                        control[i].touchDown(1, scaled.xP, scaled.yP, pressure);
                        control[i].touchCommit();
                    }
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
                    for(var i=0;i<control.length;i++) {
                        control[i].touchMove(1, scaled.xP, scaled.yP, pressure);
                        control[i].touchWait(10);
                        control[i].touchCommit();
                    }
                }
                fromYP = toYP;
                mouseWheelDelayTouchUp()
                console.log("mouseWheelListener end")
            }

            /* bind listeners */
            element.addEventListener('mousedown', mouseDownListener);
            // element.addEventListener('mousemove', mouseHoverListener);
            element.addEventListener('mousewheel', mouseWheelListener);
        }
    }
})
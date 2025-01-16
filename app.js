"use strict";
// Setup general variables
var defaultListenPort = 3666;

var core = null;
var transport = null;
var pairStatus = false;
var zoneStatus = [];
var zoneList = [];

// Change to working directory
try {
  process.chdir(__dirname);
  console.log(`Working directory: ${process.cwd()}`);
} catch (err) {
  console.error(`chdir: ${err}`);
}

// Read command line options
var commandLineArgs = require("command-line-args");
var getUsage = require("command-line-usage");

var optionDefinitions = [
  {
    name: "help",
    alias: "h",
    description: "Display this usage guide.",
    type: Boolean
  },
  {
    name: "port",
    alias: "p",
    description: "Specify the port the server listens on.",
    type: Number
  }
];

var options = commandLineArgs(optionDefinitions, { partial: true });

var usage = getUsage([
  {
    header: "Roon Cover Art",
    content:
      "Roon封面艺术.\n\nUsage: {bold node app.js <options>}"
  },
  {
    header: "Options",
    optionList: optionDefinitions
  },
  {
    content:
      "Project home: {underline https://shop236654229.taobao.com/}"
  }
]);

if (options.help) {
  console.log(usage);
  process.exit();
}

// Read config file
var config = require("config");

var configPort = config.get("server.port");

// Determine listen port
if (options.port) {
  var listenPort = options.port;
} else if (configPort) {
  var listenPort = configPort;
} else {
  var listenPort = defaultListenPort;
}
// Setup Express
var express = require("express");
var http = require("http");
var bodyParser = require("body-parser");

var app = express();
app.use(express.static("public"));
app.use(bodyParser.json());

// 添加 images 目录的静态文件服务
app.use('/images', express.static('images'));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Setup Socket IO
var server = http.createServer(app);
var io = require("socket.io").listen(server);

server.listen(listenPort, function() {
  console.log("Listening on port " + listenPort);
});

// Setup Roon
var RoonApi = require("node-roon-api");
var RoonApiImage = require("node-roon-api-image");
var RoonApiStatus = require("node-roon-api-status");
var RoonApiTransport = require("node-roon-api-transport");
var RoonApiBrowse = require("node-roon-api-browse");
var RoonApiSettings = require("node-roon-api-settings");

// 定义设置变量
var settings = {
    output: undefined
};

// 创建设置布局
function makelayout(settings) {
    var l = {
        values:    settings,
        layout:    [],
        has_error: false
    };

    l.layout.push({
        type:    "zone",
        title:   "选择播放区域",
        setting: "output",
    });

    return l;
}

// 创建 Roon API 实例
var roon = new RoonApi({
    extension_id:        "com.epochaudio.coverart",
    display_name:        "Cover Art",
    display_version:     "3.0.2",
    publisher:           "门耳朵制作",
    email:              "masked",
    website:            "https://shop236654229.taobao.com/",

    core_paired: function(_core) {
        console.log('Roon Core 配对成功');
        core = _core;
        pairStatus = true;

        // 初始化 transport 服务
        transport = _core.services.RoonApiTransport;
        if (!transport) {
            console.error('Transport service 不可用');
            svc_status.set_status("Transport服务不可用", true);
            return;
        }

        // 订阅 zones 变化
        transport.subscribe_zones((cmd, data) => {
            console.log('收到zones订阅响应:', cmd, data);
            
            try {
                if (cmd == "Subscribed") {
                    // 初始化 zones
                    zoneStatus = data.zones || [];
                    
                    // 如果有保存的区域设置，只显示选中的区域
                    if (settings.output) {
                        const selectedZone = zoneStatus.find(z => 
                            z.outputs.some(o => o.output_id === settings.output.output_id)
                        );
                        if (selectedZone) {
                            io.emit("zoneStatus", [selectedZone]);
                            return;
                        }
                    }
                    
                    io.emit("zoneStatus", zoneStatus);
                } else if (cmd == "Changed") {
                    // 处理 zones 变化
                    if (data.zones_removed) {
                        data.zones_removed.forEach(zone => {
                            zoneStatus = zoneStatus.filter(z => z.zone_id !== zone.zone_id);
                        });
                    }
                    if (data.zones_added) {
                        zoneStatus = [...zoneStatus, ...data.zones_added];
                    }
                    if (data.zones_changed) {
                        data.zones_changed.forEach(changed => {
                            const idx = zoneStatus.findIndex(z => z.zone_id === changed.zone_id);
                            if (idx !== -1) {
                                zoneStatus[idx] = changed;
                                
                                // 如果是选中的区域，发送状态更新
                                if (settings.output && 
                                    changed.outputs.some(o => o.output_id === settings.output.output_id)) {
                                    // 发送播放状态更新
                                    if (changed.state === "playing" && changed.now_playing) {
                                        io.emit("nowplaying", {
                                            image_key: changed.now_playing.image_key,
                                            state: "playing"
                                        });
                                    } else if (changed.state !== "playing") {
                                        io.emit("notPlaying", { state: changed.state });
                                    }
                                    io.emit("zoneStatus", [changed]);
                                }
                            }
                        });
                    }
                    
                    // 如果没有选中的区域，发送所有区域状态
                    if (!settings.output) {
                        io.emit("zoneStatus", zoneStatus);
                    }
                }
            } catch (err) {
                console.error('处理zones更新时出错:', err);
            }
        });

        // 通知客户端
        io.emit("pairStatus", { pairEnabled: true });
        svc_status.set_status("已连接到Roon Core", false);
    },

    core_unpaired: function(_core) {
        console.log('Roon Core 配对断开');
        
        // 重置状态
        core = null;
        transport = null;
        pairStatus = false;
        zoneStatus = [];
        zoneList = [];
        
        // 通知客户端
        io.emit("pairStatus", { pairEnabled: false });
        svc_status.set_status("等待配对", true);
    }
});

// 创建状态服务
var svc_status = new RoonApiStatus(roon);

// 创建设置服务
var svc_settings = new RoonApiSettings(roon, {
    get_settings: function(cb) {
        cb(makelayout(settings));
    },
    save_settings: function(req, isdryrun, new_settings) {
        let l = makelayout(new_settings.values);
        req.send_complete(l.has_error ? "NotValid" : "Success", { settings: l });

        if (!l.has_error && !isdryrun) {
            settings = l.values;
            roon.save_config("settings", settings);
            
            // 如果已配对，更新区域状态
            if (pairStatus && settings.output) {
                console.log('更新选中的区域:', settings.output);
                const selectedZone = zoneStatus.find(z => 
                    z.outputs.some(o => o.output_id === settings.output.output_id)
                );
                
                if (selectedZone) {
                    console.log('找到匹配的区域:', selectedZone.zone_id);
                    io.emit("zoneStatus", [selectedZone]);
                }
            }
        }
    }
});

// 初始化服务
roon.init_services({
    required_services: [RoonApiTransport, RoonApiImage, RoonApiBrowse],
    provided_services: [svc_settings, svc_status]
});

// 设置初始状态
svc_status.set_status("扩展已启用", false);

// 加载保存的设置
settings = roon.load_config("settings") || {
    output: undefined
};

// 开始发现 Roon Core
roon.start_discovery();

// Remove duplicates from zoneList array
function removeDuplicateList(array, property) {
  var x;
  var new_array = [];
  var lookup = {};
  for (x in array) {
    lookup[array[x][property]] = array[x];
  }

  for (x in lookup) {
    new_array.push(lookup[x]);
  }

  zoneList = new_array;
  io.emit("zoneList", zoneList);
}

// Remove duplicates from zoneStatus array
function removeDuplicateStatus(array, property) {
  var x;
  var new_array = [];
  var lookup = {};
  for (x in array) {
    lookup[array[x][property]] = array[x];
  }

  for (x in lookup) {
    new_array.push(lookup[x]);
  }

  zoneStatus = new_array;
  io.emit("zoneStatus", zoneStatus);
}

function refresh_browse(zone_id, options, callback) {
  options = Object.assign(
    {
      hierarchy: "browse",
      zone_or_output_id: zone_id
    },
    options
  );

  core.services.RoonApiBrowse.browse(options, function(error, payload) {
    if (error) {
      console.log(error, payload);
      return;
    }

    if (payload.action == "list") {
      var items = [];
      if (payload.list.display_offset > 0) {
        var listoffset = payload.list.display_offset;
      } else {
        var listoffset = 0;
      }
      core.services.RoonApiBrowse.load(
        {
          hierarchy: "browse",
          offset: listoffset,
          set_display_offset: listoffset
        },
        function(error, payload) {
          callback(payload);
        }
      );
    }
  });
}

function load_browse(listoffset, callback) {
  core.services.RoonApiBrowse.load(
    {
      hierarchy: "browse",
      offset: listoffset,
      set_display_offset: listoffset
    },
    function(error, payload) {
      callback(payload);
    }
  );
}

// ---------------------------- WEB SOCKET --------------
io.on("connection", function(socket) {
  // 发送当前配对状态
  socket.emit("pairStatus", { pairEnabled: pairStatus });
  
  // 如果已配对且有区域信息，发送区域状态
  if (pairStatus && zoneStatus.length > 0) {
    socket.emit("zoneStatus", zoneStatus);
  }

  socket.on("getZone", function() {
    if (pairStatus && zoneStatus.length > 0) {
      socket.emit("zoneStatus", zoneStatus);
    } else {
      console.log('Zones未就绪或为空');
      socket.emit("zoneStatus", []);
    }
  });

  socket.on("changeVolume", function(msg) {
    transport.change_volume(msg.output_id, "absolute", msg.volume);
  });

  socket.on("changeSetting", function(msg) {
    var settings = [];

    if (msg.setting == "shuffle") {
      settings.shuffle = msg.value;
    } else if (msg.setting == "auto_radio") {
      settings.auto_radio = msg.value;
    } else if (msg.setting == "loop") {
      settings.loop = msg.value;
    }

    transport.change_settings(msg.zone_id, settings, function(error) {});
  });

  socket.on("goPrev", function(msg) {
    transport.control(msg, "previous");
  });

  socket.on("goNext", function(msg) {
    transport.control(msg, "next");
  });

  socket.on("goPlayPause", function(msg) {
    transport.control(msg, "playpause");
  });

  socket.on("goPlay", function(msg) {
    transport.control(msg, "play");
  });

  socket.on("goPause", function(msg) {
    transport.control(msg, "pause");
  });

  socket.on("goStop", function(msg) {
    transport.control(msg, "stop");
  });
});

// Web Routes
app.get("/", function(req, res) {
  res.sendFile(__dirname + "/public/fullscreen.html");
});

app.get("/roonapi/getImage", function(req, res) {
  if (!core || !core.services || !core.services.RoonApiImage) {
    console.log('Roon Core未就绪或未配对');
    res.status(500).json({ error: 'Roon Core未就绪或未配对' });
    return;
  }
  
  console.log('收到图片请求:', {
    image_key: req.query.image_key,
    albumName: req.query.albumName,
    artistName: req.query.artistName
  });
  
  core.services.RoonApiImage.get_image(
    req.query.image_key,
    { scale: "fit", width: 1080, height: 1080, format: "image/jpeg" },
    async function(cb, contentType, body) {
      if (!body) {
        console.log('获取图片失败');
        res.status(500).json({ error: '获取图片失败' });
        return;
      }

      // 检查是否启用了自动保存功能
      const autoSave = config.has('artwork.autoSave') ? config.get('artwork.autoSave') : true;
      console.log('自动保存状态:', {
        autoSave,
        hasAlbumName: !!req.query.albumName,
        hasArtistName: !!req.query.artistName
      });
      
      if (autoSave && req.query.albumName) {
        try {
          console.log('开始保存专辑封面:', req.query.albumName);
          await saveArtwork(body, req.query.albumName, req.query.artistName);
        } catch (error) {
          console.error('保存专辑封面时出错:', error);
        }
      }
      
      res.contentType = contentType;
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      res.end(body, "binary");
    }
  );
});

app.get("/roonapi/getImage4k", function(req, res) {
  if (!core || !core.services || !core.services.RoonApiImage) {
    console.log('Roon Core未就绪或未配对');
    res.status(500).json({ error: 'Roon Core未就绪或未配对' });
    return;
  }
  
  core.services.RoonApiImage.get_image(
    req.query.image_key,
    { scale: "fit", width: 2160, height: 2160, format: "image/jpeg" },
    function(cb, contentType, body) {
      if (!body) {
        console.log('获取图片失败');
        res.status(500).json({ error: '获取图片失败' });
        return;
      }
      
      res.contentType = contentType;
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      res.end(body, "binary");
    }
  );
});

app.post("/roonapi/goRefreshBrowse", function(req, res) {
  refresh_browse(req.body.zone_id, req.body.options, function(payload) {
    res.send({ data: payload });
  });
});

app.post("/roonapi/goLoadBrowse", function(req, res) {
  load_browse(req.body.listoffset, function(payload) {
    res.send({ data: payload });
  });
});

app.use(
  "/jquery/jquery.min.js",
  express.static(__dirname + "/node_modules/jquery/dist/jquery.min.js")
);

app.use(
  "/js-cookie/js.cookie.js",
  express.static(__dirname + "/node_modules/js-cookie/src/js.cookie.js")
);

// 添加状态查看路由
app.get("/roonapi/artworkStatus", async function(req, res) {
  try {
    const saveDir = config.has('artwork.saveDir') 
      ? config.get('artwork.saveDir') 
      : './images';
    
    const stats = await getImageStats(saveDir);
    res.json({
      enabled: config.has('artwork.autoSave') ? config.get('artwork.autoSave') : true,
      saveDir: saveDir,
      ...stats
    });
  } catch (error) {
    console.error('获取状态失败:', error);
    res.status(500).json({ error: '获取状态失败' });
  }
});

// 添加获取图片列表的路由
app.get("/api/images", async function(req, res) {
  try {
    const saveDir = config.has('artwork.saveDir') ? config.get('artwork.saveDir') : './images';
    const files = await fs.readdir(saveDir);
    const imageFiles = files.filter(file => /\.(jpg|jpeg|png)$/i.test(file));
    res.json(imageFiles);
  } catch (error) {
    console.error('获取图片列表失败:', error);
    res.status(500).json({ error: '获取图片列表失败' });
  }
});

const fs = require('fs').promises;
const path = require('path');

async function saveArtwork(imageData, albumName, artistName) {
    try {
        const saveDir = config.has('artwork.saveDir') ? config.get('artwork.saveDir') : './images';
        const format = config.has('artwork.format') ? config.get('artwork.format') : 'jpg';
        
        // 确保目录存在
        await fs.mkdir(saveDir, { recursive: true });
        
        // 清理文件名
        const safeAlbumName = albumName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const safeArtistName = artistName ? artistName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : '';
        const fileName = safeArtistName 
            ? `${safeAlbumName}_by_${safeArtistName}.${format}`
            : `${safeAlbumName}.${format}`;
        const filePath = path.join(saveDir, fileName);
        
        // 保存文件
        await fs.writeFile(filePath, imageData);
        console.log(`保存专辑封面: ${fileName}`);
        
    } catch (error) {
        console.error('保存专辑封面失败:', error);
        throw error;
    }
}

async function getImageStats(directory) {
    try {
        await fs.mkdir(directory, { recursive: true });
        const files = await fs.readdir(directory);
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png)$/i.test(file));
        
        return {
            totalImages: imageFiles.length,
            lastSaved: imageFiles.length > 0 ? 
                (await fs.stat(path.join(directory, imageFiles[imageFiles.length - 1]))).mtime : null
        };
    } catch (error) {
        console.error('获取图片统计信息失败:', error);
        throw error;
    }
}

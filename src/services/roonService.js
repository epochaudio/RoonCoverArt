const RoonApi = require("node-roon-api");
const RoonApiImage = require("node-roon-api-image");
const RoonApiStatus = require("node-roon-api-status");
const RoonApiTransport = require("node-roon-api-transport");
const RoonApiBrowse = require("node-roon-api-browse");
const RoonApiSettings = require("node-roon-api-settings");
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

const TRANSPORT_SERVICE = "com.roonlabs.transport:2";
const TRANSPORT_COMMANDS = new Set(['playpause', 'play', 'pause', 'stop', 'previous', 'next']);
const VOLUME_MODES = new Set(['absolute', 'relative', 'relative_step']);
const MUTE_COMMANDS = new Set(['mute', 'unmute']);

class RoonService extends EventEmitter {
    constructor() {
        super();
        this.core = null;
        this.transport = null;
        this.zoneSubscription = null;
        this.pairStatus = false;
        this.zoneStatus = [];
        this.settings = { output: undefined };

        this.initServices();
    }

    initServices() {
        this.roon = new RoonApi({
            extension_id: "com.epochaudio.coverart",
            display_name: "CoverArt_Square_Docker",
            display_version: "3.1.8",
            publisher: "门耳朵制作",
            email: "masked",
            website: "https://shop236654229.taobao.com/",

            core_paired: (core) => this.handleCorePaired(core),
            core_unpaired: (core) => this.handleCoreUnpaired(core)
        });

        this.configurePersistence();

        this.svc_status = new RoonApiStatus(this.roon);
        this.svc_settings = new RoonApiSettings(this.roon, {
            get_settings: (cb) => cb(this.makeLayout(this.settings)),
            save_settings: (req, isdryrun, new_settings) => {
                const l = this.makeLayout(new_settings.values);
                req.send_complete(l.has_error ? "NotValid" : "Success", { settings: l });
                if (!l.has_error && !isdryrun) {
                    this.settings = l.values;
                    this.roon.save_config("settings", this.settings);
                    this.updateSelectedZone();
                }
            }
        });

        this.roon.init_services({
            required_services: [RoonApiTransport, RoonApiImage, RoonApiBrowse],
            provided_services: [this.svc_settings, this.svc_status]
        });

        this.svc_status.set_status("Extension enabled", false);
        this.settings = this.roon.load_config("settings") || { output: undefined };
    }

    configurePersistence() {
        const configuredPath = process.env.ROON_PERSIST_PATH || "config.json";
        const appRoot = path.resolve(__dirname, "../..");
        const resolvedPath = path.isAbsolute(configuredPath)
            ? configuredPath
            : path.resolve(appRoot, configuredPath);
        let persistFile = resolvedPath;

        try {
            if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
                persistFile = path.join(resolvedPath, "roon-config.json");
                console.warn(`ROON_PERSIST_PATH points to a directory, using ${persistFile}`);
            }

            const persistDir = path.dirname(persistFile);
            if (!fs.existsSync(persistDir)) {
                fs.mkdirSync(persistDir, { recursive: true });
            }

            if (!fs.existsSync(persistFile)) {
                fs.writeFileSync(persistFile, "{}");
            }
        } catch (err) {
            console.error("Failed to prepare Roon persistence file:", err);
        }

        this.persistFile = persistFile;

        this.roon.save_config = (key, value) => {
            try {
                let configData = {};
                try {
                    configData = JSON.parse(fs.readFileSync(this.persistFile, { encoding: 'utf8' })) || {};
                } catch (e) {
                    configData = {};
                }

                if (value === undefined || value === null) {
                    delete configData[key];
                } else {
                    configData[key] = value;
                }

                fs.writeFileSync(this.persistFile, JSON.stringify(configData, null, '    '));
            } catch (e) {
                console.error("Failed to save Roon config:", e);
            }
        };

        this.roon.load_config = (key) => {
            try {
                const content = fs.readFileSync(this.persistFile, { encoding: 'utf8' });
                return JSON.parse(content)[key];
            } catch (e) {
                return undefined;
            }
        };
    }

    start() {
        this.roon.start_discovery();
    }

    stop() {
        const core = this.core;

        this.unsubscribeZones();
        this.core = null;
        this.transport = null;
        this.pairStatus = false;
        this.zoneStatus = [];

        if (core && core.moo && core.moo.transport && typeof core.moo.transport.close === 'function') {
            try {
                core.moo.transport.close();
            } catch (error) {
                console.warn('Failed to close Roon Core connection:', error);
            }
        }
    }

    makeLayout(settings) {
        const l = {
            values: settings,
            layout: [],
            has_error: false
        };
        l.layout.push({
            type: "zone",
            title: "Select Zone",
            setting: "output",
        });
        return l;
    }

    handleCorePaired(core) {
        console.log('Roon Core Paired');
        this.unsubscribeZones();

        this.core = core;
        this.transport = core.services.RoonApiTransport;
        this.pairStatus = true;

        if (!this.transport) {
            console.error('Transport service unavailable');
            this.svc_status.set_status("Transport unavailable", true);
            return;
        }

        this.subscribeZones();

        this.emit('pairStatus', { pairEnabled: true });
        this.svc_status.set_status("Connected to Roon Core", false);
    }

    handleCoreUnpaired(core) {
        console.log('Roon Core Unpaired');
        this.unsubscribeZones();

        this.core = null;
        this.transport = null;
        this.pairStatus = false;
        this.zoneStatus = [];

        this.emit('pairStatus', { pairEnabled: false });
        this.svc_status.set_status("Waiting for pairing", true);
    }

    subscribeZones() {
        if (!this.core || !this.core.moo || !this.transport) return;

        this.zoneSubscription = this.core.moo._subscribe_helper(
            TRANSPORT_SERVICE,
            "zones",
            (cmd, data) => this.handleZoneEvent(cmd, data)
        );
    }

    unsubscribeZones() {
        if (!this.zoneSubscription || typeof this.zoneSubscription.unsubscribe !== 'function') {
            this.zoneSubscription = null;
            return;
        }

        try {
            this.zoneSubscription.unsubscribe();
        } catch (err) {
            console.warn('Failed to unsubscribe zones:', err);
        } finally {
            this.zoneSubscription = null;
        }
    }

    handleZoneEvent(cmd, data) {
        try {
            if (cmd === "Subscribed") {
                this.zoneStatus = data.zones || [];
                this.emitZones();
            } else if (cmd === "Changed") {
                if (data.zones_removed) {
                    data.zones_removed.forEach(zone => {
                        const zoneId = typeof zone === 'string' ? zone : zone.zone_id;
                        this.zoneStatus = this.zoneStatus.filter(z => z.zone_id !== zoneId);
                    });
                }
                if (data.zones_added) {
                    this.zoneStatus = [...this.zoneStatus, ...data.zones_added];
                }
                if (data.zones_changed) {
                    data.zones_changed.forEach(changed => {
                        const idx = this.zoneStatus.findIndex(z => z.zone_id === changed.zone_id);
                        if (idx !== -1) {
                            this.zoneStatus[idx] = changed;
                            this.checkZoneUpdate(changed);
                        }
                    });
                }
                this.emitZones();
            }
        } catch (err) {
            console.error('Error handling zone event:', err);
        }
    }

    checkZoneUpdate(zone) {
        if (!this.settings.output) return;

        if (!this.isSelectedZone(zone)) return;

        if (zone.state === "playing" && zone.now_playing) {
            this.emit("nowplaying", {
                ...zone.now_playing,
                state: "playing"
            });
        } else if (zone.state !== "playing") {
            this.emit("notPlaying", { state: zone.state });
        }
    }

    emitZones() {
        this.emit("zoneStatus", this.getVisibleZones());
    }

    updateSelectedZone() {
        if (this.pairStatus) {
            this.emitZones();
        }
    }

    isSelectedZone(zone) {
        if (!this.settings.output || !zone || !zone.outputs) return false;
        return zone.outputs.some(o => o.output_id === this.settings.output.output_id);
    }

    getSelectedZone() {
        if (!this.core || !this.transport || !this.settings.output) return null;
        return this.zoneStatus.find(z => this.isSelectedZone(z)) || null;
    }

    getSelectedOutputId() {
        return this.settings && this.settings.output ? this.settings.output.output_id : null;
    }

    getVisibleZones() {
        if (!this.core || !this.transport) return [];
        const selectedZone = this.getSelectedZone();
        return selectedZone ? [selectedZone] : this.zoneStatus;
    }

    // Public API Methods

    getImage(image_key, options, callback) {
        if (!this.core || !this.core.services.RoonApiImage) {
            return callback("Core not paired", null, null);
        }
        this.core.services.RoonApiImage.get_image(image_key, options, callback);
    }

    control(zoneId, command) {
        if (!this.transport || !zoneId || !TRANSPORT_COMMANDS.has(command)) return false;
        const msg = { zone_id: zoneId };
        this.transport.control(msg, command);
        return true;
    }

    changeVolume(outputId, mode, value) {
        if (!this.transport || !outputId || !VOLUME_MODES.has(mode) || !Number.isFinite(value)) return false;
        this.transport.change_volume(outputId, mode, value);
        return true;
    }

    muteOutput(outputId, how) {
        if (!this.transport || !outputId || !MUTE_COMMANDS.has(how)) return false;
        this.transport.mute(outputId, how);
        return true;
    }

    changeSettings(zoneId, settings) {
        if (!this.transport || !zoneId || !settings || Object.keys(settings).length === 0) return false;
        this.transport.change_settings(zoneId, settings, (err) => { });
        return true;
    }

    browse(options, callback) {
        if (!this.core || !this.core.services.RoonApiBrowse) {
            return callback("Core not paired");
        }
        this.core.services.RoonApiBrowse.browse(options, (err, payload) => {
            if (err) return callback(err);
            if (payload.action === 'list') {
                // Auto load if list
                const offset = payload.list.display_offset || 0;
                this.core.services.RoonApiBrowse.load({
                    hierarchy: "browse",
                    offset: offset,
                    set_display_offset: offset
                }, (err, payload) => callback(err, payload));
            } else {
                callback(null, payload);
            }
        });
    }

    loadBrowse(options, callback) {
        if (!this.core || !this.core.services.RoonApiBrowse) {
            return callback("Core not paired");
        }
        this.core.services.RoonApiBrowse.load(options, (err, payload) => callback(err, payload));
    }

    getZoneStatus() {
        if (!this.core || !this.transport) return null;
        return this.zoneStatus;
    }
}

module.exports = new RoonService();

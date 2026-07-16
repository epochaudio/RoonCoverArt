"use strict";

const express = require('express');
const http = require('http');
const path = require('path');
const config = require('config');
const socketIO = require('socket.io');

const apiRoutes = require('./routes/api');
const roonService = require('./services/roonService');
const socketService = require('./services/socketService');
const keyboardService = require('./services/keyboardService');

// Setup process
process.chdir(path.join(__dirname, '..')); // Move to root if running from src
console.log(`Working directory: ${process.cwd()}`);

// Config
const defaultListenPort = 3666;
const configPort = config.has("server.port") ? config.get("server.port") : defaultListenPort;
const listenPort = process.env.PORT || configPort;

// Express setup
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/images', express.static(path.resolve(config.get('artwork.saveDir'))));
app.use('/js-cookie', express.static(path.join(__dirname, '../node_modules/js-cookie/dist')));

// CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});

// Routes
app.use('/', apiRoutes);

// Init Services
socketService.init(io);
roonService.start();
keyboardService.start();

// Start Server
server.listen(listenPort, () => {
    console.log(`Roon Cover Art Server listening on port ${listenPort}`);
});

let shutdownStarted = false;

async function shutdown(reason, exitCode) {
    if (shutdownStarted) return;
    shutdownStarted = true;
    process.exitCode = exitCode;

    console.log('Shutting down: ' + reason);

    const forceExitTimer = setTimeout(() => {
        console.error('Shutdown timed out, forcing exit');
        process.exit(exitCode);
    }, 5000);

    try {
        keyboardService.stop();
        roonService.stop();
        await io.close();
    } catch (error) {
        console.error('Shutdown error:', error);
        process.exitCode = 1;
    } finally {
        clearTimeout(forceExitTimer);
        process.exit(process.exitCode);
    }
}

process.once('SIGTERM', () => {
    shutdown('SIGTERM', 0);
});

process.once('SIGINT', () => {
    shutdown('SIGINT', 0);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    shutdown('uncaught exception', 1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandled rejection', 1);
});

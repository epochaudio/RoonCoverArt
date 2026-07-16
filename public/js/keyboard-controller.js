"use strict";

class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    emit(event, data) {
        const callbacks = this.events[event] || [];
        callbacks.forEach(callback => callback(data));
    }
}

class KeyboardController extends EventEmitter {
    constructor() {
        super();
        this.keyMap = {
            Space: 'playpause',
            KeyP: 'play',
            Escape: 'stop',
            ArrowLeft: 'previous',
            ArrowRight: 'next',
            MediaPlayPause: 'playpause',
            MediaPlay: 'play',
            MediaPause: 'pause',
            MediaStop: 'stop',
            MediaTrackPrevious: 'previous',
            MediaTrackNext: 'next'
        };
        this.preventDefaultKeys = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'Escape']);

        this.setupKeyboardEvents();
        this.setupMediaSession();
    }

    setupKeyboardEvents() {
        document.addEventListener('keydown', event => {
            const command = this.keyMap[event.code];
            if (!command) return;

            if (this.preventDefaultKeys.has(event.code)) {
                event.preventDefault();
            }
            this.sendTransportCommand(command);
        }, true);
    }

    sendTransportCommand(command) {
        this.emit('transport', { command });
    }

    setupMediaSession() {
        if (!('mediaSession' in navigator) || !('MediaMetadata' in window)) return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Roon 音乐播放器',
            artist: '',
            album: '',
            artwork: []
        });

        const actionHandlers = {
            play: () => this.sendTransportCommand('play'),
            pause: () => this.sendTransportCommand('pause'),
            stop: () => this.sendTransportCommand('stop'),
            previoustrack: () => this.sendTransportCommand('previous'),
            nexttrack: () => this.sendTransportCommand('next')
        };

        for (const [action, handler] of Object.entries(actionHandlers)) {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (error) {
                console.warn(`设置 MediaSession 动作失败: ${action}`, error);
            }
        }
    }

    updateMediaSession(metadata) {
        if (!('mediaSession' in navigator) || !('MediaMetadata' in window) || !metadata) return;

        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: metadata.title || '',
                artist: metadata.artist || '',
                album: metadata.album || '',
                artwork: metadata.artwork || []
            });
        } catch (error) {
            console.error('更新 MediaSession 元数据失败:', error);
        }
    }

    setPlaybackState(state) {
        if (!('mediaSession' in navigator)) return;

        try {
            navigator.mediaSession.playbackState = state;
        } catch (error) {
            console.error('设置 MediaSession 播放状态失败:', error);
        }
    }
}

window.KeyboardController = KeyboardController;

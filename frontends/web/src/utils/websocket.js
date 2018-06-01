import { apiPort, apiToken, isTLS } from './request';
import { debug } from './env';

const currentListeners = [];
let socket = null;

export function apiWebsocket(msgCallback) {
    if (!window.currentListeners) {
        window.currentListeners = [];
    }
    window.currentListeners.push(msgCallback);
    // In browser/debug mode, receive push notifications on a websocket.
    if (debug && !socket) {
        socket = new WebSocket((isTLS() ? 'wss://' : 'ws://') + 'localhost:' + apiPort + '/api/events');

        socket.onopen = function(event) {
            socket.send('Authorization: Basic ' + apiToken);
        };

        socket.onerror = function(event) {
            console.log('websocket error');
            console.log(event);
        };

        // Listen for messages
        socket.onmessage = function(event) {
            const payload = JSON.parse(event.data);
            window.currentListeners.forEach(listener => listener(payload));
        };

        socket.onclose = function(event) {
            window.currentListeners.forEach(listener => listener({ type: "frontend", data: "closed"}));
        };
    }

    return () => {
        if (!window.currentListeners.includes(msgCallback)) {
            console.warn('!window.currentListeners.includes(msgCallback)');
        }
        const index = window.currentListeners.indexOf(msgCallback);
        window.currentListeners.splice(index, 1);
        if (window.currentListeners.includes(msgCallback)) {
            console.warn('window.currentListeners.includes(msgCallback)');
        }
    };
}

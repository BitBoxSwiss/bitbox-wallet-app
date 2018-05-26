import { apiPort, apiToken, isTLS } from './request';

const currentListeners = [];
let socket = null;

export function apiWebsocket(msgCallback) {

    currentListeners.push(msgCallback);

    if (!socket) {
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
            currentListeners.forEach(listener => listener(payload));
        };

        socket.onclose = function(event) {
            currentListeners.forEach(listener => listener({ type: "frontend", data: "closed"}));
        };
    }

    return () => {
        if (!currentListeners.includes(msgCallback)) {
            console.warn('!currentListeners.includes(msgCallback)');
        }
        const index = currentListeners.indexOf(msgCallback);
        currentListeners.splice(index, 1);
        if (currentListeners.includes(msgCallback)) {
            console.warn('currentListeners.includes(msgCallback)');
        }
    };
}

import { extConfig } from './config';

const apiPort = extConfig('{{ API_PORT }}', '8082');
const apiToken = extConfig('{{ API_TOKEN }}', '');

function isTLS() {
    return document.URL.startsWith('https://');
}

export function apiURL(endpoint) {
    return (isTLS() ? 'https://' : 'http://') + 'localhost:' + apiPort + '/api/' + endpoint;
}

export function apiWebsocket(msgCallback) {
    const socket = new WebSocket((isTLS() ? 'wss://' : 'ws://') + 'localhost:' + apiPort + '/api/events');
    socket.onopen = function(event) {
        socket.send('Authorization: Basic ' + apiToken);
    };
    socket.onerror = function(event) {
        console.log('error');
        console.log(event);
    };
    // Listen for messages
    socket.onmessage = function(event) {
        msgCallback(JSON.parse(event.data));
    };
    socket.onclose = function(event) {
        console.log('close');
    };
}

function handleError(json) {
    return new Promise((resolve, reject) => {
        if (json && json.error) {
            alert(json.error + ' (todo: nice error msgs)');
            reject(json.error);
            return;
        }
        resolve(json);
    });
}

export function apiGet(endpoint) {
    return fetch(apiURL(endpoint), {
        method: 'GET'
    }).then(r => r.json()).then(handleError);
}

export function apiPost(endpoint, body) {
    return fetch(
        apiURL(endpoint),
        {
            method: 'POST',
            body: JSON.stringify(body)
        }).
        then(r => r.json()).then(handleError);
}

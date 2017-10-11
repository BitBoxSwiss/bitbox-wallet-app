// extConfig is a way to set config values which which are inserted externally by templating engines
// (code generation). A default value is provided in case the file wasn't generated but used
// directly, for convenience when developing.

function extConfig(key, defaultValue) {
    if(typeof key == "string" && key.startsWith("{{ ") && key.endsWith(" }}")) {
        return defaultValue;
    }
    return key;
}

const apiPort = extConfig('{{ API_PORT }}', '8082');

export function apiWebsocket(msgCallback) {
    const socket = new WebSocket('ws://localhost:' + apiPort + '/api/events');
    socket.onopen = function(event) {
        socket.send('Hello Server!');
    };
    socket.onerror = function(event) {
        console.log("error");
        console.log(event);
    };
    // Listen for messages
    socket.onmessage = function(event) {
        msgCallback(JSON.parse(event.data));
    };
    socket.onclose = function(event) {
        console.log("close");
    }
}

function handleError(json) {
    return new Promise((resolve, reject) => {
        if(json && json.error) {
            alert(json.error + " (todo: nice error msgs)");
            reject(json.error);
            return;
        }
        resolve(json);
    });
}

export function apiGet(endpoint) {
    return fetch("http://localhost:" + apiPort + "/api/" + endpoint).
        then(r => r.json()).then(handleError);
}

export function apiPost(endpoint, body) {
    return fetch(
        "http://localhost:" + apiPort + "/api/" + endpoint,
        {
            method: "POST",
            body: JSON.stringify(body)
        }).
        then(r => {
            return r.json();
        }).then(handleError);
}

import { extConfig } from './config';

export const apiPort = extConfig('{{ API_PORT }}', '8082');
export const apiToken = extConfig('{{ API_TOKEN }}', '');

export function isTLS() {
    return document.URL.startsWith('https://');
}

export function apiURL(endpoint) {
    return (isTLS() ? 'https://' : 'http://') + 'localhost:' + apiPort + '/api/' + endpoint;
}

function handleError(json) {
    return new Promise((resolve, reject) => {
        if (json && json.error) {
            /* eslint no-alert: "warn" */
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

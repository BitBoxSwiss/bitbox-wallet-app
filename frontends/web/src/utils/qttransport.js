import { QWebChannel } from './qwebchannel';

let cache = null;
let webChannel = null;
let queryID = 0;
let queryPromises = {};
let currentListeners = [];

function initTransport() {
    return new Promise((resolve, reject) => {
        if (webChannel) {
            resolve(webChannel);
        } else if (cache) {
            const check = function() { // eslint-disable-line func-style
                if (webChannel) {
                    resolve(webChannel);
                } else {
                    window.setTimeout(check, 1);
                }
            };
            check();
        } else if (typeof qt !== 'undefined') { // qt defined if running in qtwebengine.
            const initWebChannel = function(channel){ // eslint-disable-line func-style
                webChannel = channel;
                webChannel.objects.backend.gotResponse.connect(function(queryID, response) {
                    queryPromises[queryID].resolve(JSON.parse(response));
                })
                webChannel.objects.backend.pushNotify.connect(function(msg) {
                    if (currentListeners) {
                        currentListeners.forEach(listener => listener(JSON.parse(msg)));
                    }
                });
                resolve(webChannel);
            };
            cache = new QWebChannel(qt.webChannelTransport, initWebChannel); // eslint-disable-line no-undef
        } else {
            reject();
        }
    });
}

export function call(query) {
    return new Promise((resolve, reject) => {
        initTransport().then(channel => {
            queryID++;
            queryPromises[queryID] = { resolve, reject };
            channel.objects.backend.call(queryID, query);
        });
    });
}

export function qtSubscribePushNotifications(msgCallback) {
    currentListeners.push(msgCallback);
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

const ReconnectingWebsocket = require('reconnecting-websocket');
const ws = require('ws');
const EventEmitter = require('events').EventEmitter;

class SyncClient extends EventEmitter
{
    async connect(url)
    {
        return new Promise((resolve, reject) =>
        {
            this.rws = new ReconnectingWebsocket(url, [], {
                WebSocket: ws
            });
            const resolveEvent = () => {
                this.rws.removeEventListener('open', resolveEvent);
                resolve();
            };
            this.rws.addEventListener('open', resolveEvent);
            
            this.rws.addEventListener('message', event =>
            {
                const data = JSON.parse(event.data);
                this.emit('data', data);
            });
        });
    }
    
    send(data)
    {
        this.rws.send((typeof data === 'string') ? data : JSON.stringify(data));
    }
}

module.exports = new SyncClient();

const {Rcon} = require('rcon-client');
const EventEmitter = require('events').EventEmitter;

class RconManager extends EventEmitter
{
    constructor()
    {
        super();
        this.connected = false;
    }
    
    async connect(host, port, password)
    {
        this.rcon = new Rcon({host, port, password});
        this.rcon.on('connect', () =>
        {
            this.emit('connect');
            this.connected = true;
        });
        this.rcon.on('end', () =>
        {
            this.emit('disconnect');
            this.connected = false;
        });
        await this.rcon.connect();
    }
    
    async send(message)
    {
        return this.rcon.send(message);
    }
}

module.exports = new RconManager();

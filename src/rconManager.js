const {Rcon} = require('rcon-client');
const awaitTimeout = require('./awaitTimeout');
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
        this.rcon.on('error', err =>
        {
            this.emit('error', err);
            this.connected = false;
        });
        await this.rcon.connect();
    }
    
    async send(message)
    {
        return this.rcon.send(message);
    }
    
    async sendReliable(message, test, maxRetries, delay)
    {
        if(!(maxRetries > 0))
        {
            maxRetries = Number.MAX_SAFE_INTEGER;
        }
        for(let i = 0; i < maxRetries; i++)
        {
            let data;
            try
            {
                data = await this.rcon.send(message);
            }
            catch(e)
            {
                data = null;
            }
            
            if(test(data))
            {
                return data;
            }
            
            await awaitTimeout((delay > 0) ? delay : 100);
        }
        return null;
    }
}

module.exports = new RconManager();

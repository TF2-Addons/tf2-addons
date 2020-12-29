const rconManager = require('./rconManager');
const consoleParse = require('./consoleParse');
const EventEmitter = require('events').EventEmitter;

class GameState extends EventEmitter
{
    constructor()
    {
        super();
        
        this.kills = [];
        
        consoleParse.on('kill', killData =>
        {
            this.kills.push(killData);
        });
    }
    
    async getName()
    {
        const nameLine = (await rconManager.send('name')).split('\n')[0];
        return nameLine.substring(10, nameLine.length - 20);
    }
    
    async getTaunts()
    {
        const lines = (await rconManager.send('taunt_by_name')).split('\n');
        return lines.splice(2, lines.length - 3);
    }
}

module.exports = new GameState();

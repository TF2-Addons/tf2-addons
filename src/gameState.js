const rconManager = require('./rconManager');
const consoleParse = require('./consoleParse');
const EventEmitter = require('events').EventEmitter;

class GameState extends EventEmitter
{
    constructor()
    {
        super();
        this.lobbyIDRegex = new RegExp('ID:([\\w\\d]+)');
        this.lobbyPlayerRegex = new RegExp('(Member|Pending)\\[(\\d+)\\]\\s+(\\[.+?\\])\\s+team = (\\w+)\\s+type = (\\w+)');
        
        this.kills = [];
        this.players = [];
        this.chat = [];
        
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
    
    async getStatus()
    {
        return new Promise((resolve, reject) =>
        {
            consoleParse.once('status', resolve);
            consoleParse.statusFlag = true;
            rconManager.send('status; wait 20; echo end-status');
        });
    }
    
    async getLobbyDebug()
    {
        const lobbyDebug = await rconManager.send('tf_lobby_debug');
        if(lobbyDebug === 'Failed to find lobby shared object\n')
        {
            return null;
        }
        const lobby = {
            id: '',
            members: [],
            pending: []
        };
        const lines = lobbyDebug.split('\n').filter(line => line.length > 0);
        lobby.id = this.lobbyIDRegex.exec(lines.shift())[1];
        for(const line of lines)
        {
            const [, status, index, id, team, type] = this.lobbyPlayerRegex.exec(line);
            (status === 'Member' ? lobby.members : lobby.pending).push({status, index, id, team, type});
        }
        return lobby;
    }
}

module.exports = new GameState();

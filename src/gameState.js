const rconManager = require('./rconManager');
const consoleParse = require('./consoleParse');
const logger = require('./logger');
const EventEmitter = require('events').EventEmitter;
const awaitTimeout = require('./awaitTimeout');

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
        this.status = null;
        this.monitorStatus = false;
        
        consoleParse.on('kill', killData =>
        {
            this.kills.push(killData);
        });
    }
    
    beginMonitor()
    {
        (async () =>
        {
            if(this.monitorStatus)
            {
                return;
            }
            this.monitorStatus = true;
            
            let statusBadCount = 0;
            const statusBadMax = 3;
            while(this.monitorStatus)
            {
                await awaitTimeout(2000);
                try
                {
                    // Check if in a lobby (casual mode server)
                    const lobby = await this.getLobbyDebug();
                    if(lobby === null)
                    {
                        if(this.status !== null)
                        {
                            logger.warn('Clearing game for bad lobby');
                        }
                        this.clearGame();
                        continue;
                    }
                    // Get the status
                    const statusData = await this.getStatus();
                    if(statusData.players.length === 0)
                    {
                        statusBadCount++;
                        logger.warn(`${statusBadCount} bad status`);
                        if(statusBadCount === statusBadMax)
                        {
                            if(this.status !== null)
                            {
                                logger.warn('Clearing game for bad status');
                            }
                            this.clearGame();
                        }
                        continue;
                    }
                    statusBadCount = 0;
        
                    const newPlayers = statusData.players.map(player =>
                    {
                        player.team = lobby.members.filter(member => member.id === player.id);
                        return player;
                    });
                    const playersJoined = newPlayers.filter(newPlayer =>
                    {
                        for(const oldPlayer of this.players)
                        {
                            if(oldPlayer.id === newPlayer.id)
                            {
                                return false;
                            }
                        }
                        return true;
                    });
                    const playersLeft = this.players.filter(oldPlayer =>
                    {
                        for(const newPlayer of newPlayers)
                        {
                            if(newPlayer.id === oldPlayer.id)
                            {
                                return false;
                            }
                        }
                        return true;
                    });
                    for(const joined of playersJoined)
                    {
                        this.emit('player-join', joined);
                    }
                    for(const left of playersLeft)
                    {
                        this.emit('player-leave', left);
                    }
                    this.players = newPlayers;
                    this.emit('players', newPlayers);
                    this.emit('status', statusData.meta);
                }
                catch(ignored) {}
            }
        })();
    }
    
    clearGame()
    {
        if(this.players.length > 0)
        {
            this.emit('players', []);
        }
        if(this.status !== null)
        {
            this.emit('status', null);
        }
        this.kills = [];
        this.players = [];
        this.chat = [];
        this.status = null;
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
            consoleParse.flagStatusCheck();
            rconManager.send('status');
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

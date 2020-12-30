const tf2Paths = require('./tf2Paths');
const {Tail} = require('tail');
const EventEmitter = require('events').EventEmitter;
const logger = require('./logger');
const {replaceInvisibleSequence} = require('./updateLocalizations');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

class ConsoleParse extends EventEmitter
{
    constructor()
    {
        super();
        this.connectedRegex = new RegExp('Connected to (\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}):(\\d{1,6})');
        this.addonRegex = new RegExp('!tf2addons\\[(.+?)\\]');
        this.killRegex = new RegExp('(.+?) killed (.+?) with (.+?)\\.');
        this.nameIdRegex = new RegExp('#\\s*(\\d+)\\s*"(.+)"');
        this.statusLabels = ['hostname', 'version', 'udp/ip', 'steamid', 'account', 'map', 'tags', 'players', 'edicts'];
        this.statusTemp = {meta: {}, players: []};
        this.statusFlag = {looking: false, found: false};
    }
    
    begin(replacements)
    {
        this.replacements = replacements;
        this.logTail = new Tail(tf2Paths.log, {
            useWatchFile: true,
            fsWatchOptions: {
                interval: 250
            }
        });
        logger.info(`Reading ${tf2Paths.log}`);
        const dateTimeRegex = new RegExp('^(\\d+\\/\\d+\\/\\d+ - \\d+:\\d+:\\d+): ');
    
        const adapter = new FileSync(`./logs/lines-${Date.now()}.json`);
        const db = low(adapter);
        
        db.defaults({
            lines: [],
            replacements,
            parsedReplacements: JSON.parse(replaceInvisibleSequence(JSON.stringify(replacements)))
        }).write();
        
        let tailState = {
            buffer: '',
            inChat: false,
            messageType: ''
        };
        this.logTail.on('line', data =>
        {
            const dateTimeMatch = dateTimeRegex.exec(data);
            let line = (!dateTimeMatch ? data : data.replace(dateTimeMatch[0], '')).trim();
            
            db.get('lines').push({
                time: Date.now(),
                raw: data,
                parsed: replaceInvisibleSequence(line),
                tailState: (tailState.buffer.length > 0 ? JSON.parse(JSON.stringify(tailState)) : undefined)
            }).write();
            
            // If there's still an unfinished chat line going on (from a cheater), keep reading
            if(tailState.inChat)
            {
                logger.warn('Still reading chat');
                const replacement = this.replacements.chat.filter(r => r.type === tailState.messageType)[0];
                if(line.endsWith(replacement.end))
                {
                    this.emit('chat', {
                        type: tailState.messageType,
                        ...this.parseChat(tailState.buffer + line)
                    });
                    tailState.buffer = '';
                    tailState.inChat = false;
                }
                else
                {
                    tailState.buffer += line + '\n';
                }
                return;
            }
            
            // See if currently parsing status
            if(this.statusFlag.looking)
            {
                // Check first part of status
                for(const statusLabel of this.statusLabels)
                {
                    if(line.startsWith(statusLabel))
                    {
                        this.statusFlag.found = true;
                        this.statusTemp.meta[statusLabel] = line.substring(line.indexOf(': ') + 2);
                        return;
                    }
                }
    
                if(line.startsWith('#'))
                {
                    if(line.endsWith('state'))
                    {
                        // Skip the line with table headers
                        return;
                    }
                    this.statusTemp.players.push(this.parseStatusPlayer(line));
                    return;
                }
                
                if(this.statusFlag.found)
                {
                    this.statusFlag = {looking: false, found: false};
                    this.emit('status', this.statusTemp);
                    this.statusTemp = {meta: {}, players: []};
                }
            }
            
            // Check for a known chat format
            for(const chatReplacement of this.replacements.chat)
            {
                if(line.startsWith(chatReplacement.start))
                {
                    if(line.endsWith(chatReplacement.end))
                    {
                        this.emit('chat', {
                            type: chatReplacement.type,
                            ...this.parseChat(line)
                        });
                    }
                    else
                    {
                        // If it doesn't end with the ending characters, it's almost certainly a cheater
                        // This means newline characters are being sent
                        logger.warn(`MULTILINE warning: ${line}`);
                        tailState.buffer = line + '\n';
                        tailState.messageType = chatReplacement.type;
                        tailState.inChat = true;
                    }
                    return;
                }
            }
            
            // Check if the player joined
            if(line.startsWith(this.replacements['name'].start))
            {
                this.emit('join', {
                    name: this.getName(line)
                });
                return;
            }
            
            const connectedData = this.connectedRegex.exec(line);
            if(connectedData)
            {
                this.emit('connect', {
                    ip: connectedData[1],
                    port: connectedData[2]
                });
                return;
            }
            
            const addonData = this.addonRegex.exec(line);
            if(addonData)
            {
                this.emit('addon-data', {
                    full: addonData[1],
                    data: addonData[1].split(',')
                });
                return;
            }
    
            const killData = this.killRegex.exec(line);
            if(killData)
            {
                this.emit('kill', {
                    chat: line,
                    killer: killData[1],
                    killed: killData[2],
                    weapon: killData[3]
                });
                return;
            }
        });
    }
    
    parseChat(text)
    {
        return {
            name: this.getName(text),
            message: text.split(this.replacements.message.start)[1].split(this.replacements.message.end)[0],
        };
    }
    
    getName(text)
    {
        return text.split(this.replacements.name.start)[1].split(this.replacements.name.end)[0];
    }
    
    parseStatusPlayer(line)
    {
        const sections = ['name', 'uniqueid', 'connected', 'ping', 'loss', 'state'];
        const allowedSpaces = ['name'];
        const state = {
            section: sections.length - 1,
            spaceUntilNext: false,
            parts: sections.reduce((acc, val) =>
            {
                acc[val] = '';
                return acc;
            }, {})
        };
        // Parse the line backwards such that strange names won't mess up the parsing
        // Thanks Steam for allowing quotes in usernames
        for(let i = line.length - 1; i >= 0; i--)
        {
            const ch = line[i];
            if(ch === ' ')
            {
                if(state.spaceUntilNext)
                {
                    continue;
                }
                // If spaces aren't allowed for this section, move to the next one
                if(allowedSpaces.indexOf(sections[state.section]) === -1)
                {
                    if(state.section === 0)
                    {
                        return state.parts;
                    }
                    state.spaceUntilNext = true;
                    state.section--;
                    continue;
                }
            }
            state.spaceUntilNext = false;
            
            // If it's a bot, skip straight to uniqueid
            if(sections[state.section] === 'loss' && ch === 'T')
            {
                state.section = sections.indexOf('uniqueid');
            }
            
            state.parts[sections[state.section]] = ch + state.parts[sections[state.section]];
        }
        
        const [id, name] = this.nameIdRegex.exec(state.parts['name']).splice(1);
        return {
            ...state.parts,
            id,
            name
        };
    }
}

module.exports = new ConsoleParse();

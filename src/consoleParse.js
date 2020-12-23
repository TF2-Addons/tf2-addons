const tf2Paths = require('./tf2Paths');
const {Tail} = require('tail');
const EventEmitter = require('events').EventEmitter;
const logger = require('./logger');

class ConsoleParse extends EventEmitter
{
    begin(replacements)
    {
        this.replacements = replacements;
        this.connectedRegex = new RegExp('Connected to (\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}):(\\d{1,6})');
        this.addonRegex = new RegExp('!tf2addons\\[(.+?)\\]');
        
        this.logTail = new Tail(tf2Paths.log, {
            useWatchFile: true,
            fsWatchOptions: {
                interval: 250
            }
        });
        const dateTimeRegex = new RegExp('^(\\d+\\/\\d+\\/\\d+ - \\d+:\\d+:\\d+): ');
        
        let tailState = {
            buffer: '',
            inChat: false,
            messageType: ''
        };
        this.logTail.on('line', data =>
        {
            const dateTimeMatch = dateTimeRegex.exec(data);
            let line = (!dateTimeMatch ? data : data.replace(dateTimeMatch[0], '')).trim();
            
            // If there's still an unfinished chat line going on (from a cheater), keep reading
            if(tailState.inChat)
            {
                logger.warn('Still reading chat');
                console.log(this.replacements);
                if(line.endsWith(this.replacements.chat[tailState.messageType].end))
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
}

module.exports = new ConsoleParse();

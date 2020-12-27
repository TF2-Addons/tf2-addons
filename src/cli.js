const vorpal = require('@moleculer/vorpal')();
const Transport = require('winston-transport');
const {MESSAGE} = require('triple-beam');
const rconManager = require('./rconManager');
const {getName} = require('./gamestate');

class VorpalTransport extends Transport
{
    constructor(opts)
    {
        super(opts);
    }
    
    log(info, callback)
    {
        setImmediate(() => this.emit('logged', info));
        
        vorpal.log(info[MESSAGE]);
        callback();
    }
}

vorpal.command('rcon <command...>', 'Run an RCON command and get output').action(async function(args, callback)
{
    const data = await rconManager.send(args.command.join(' '));
    this.log(JSON.stringify(data));
    callback();
});

vorpal.command('name', 'Get the player name').action(async function(args, callback)
{
    this.log(await getName());
    callback();
});

vorpal.delimiter('tf2addons$').show();

module.exports = {VorpalTransport, vorpal};

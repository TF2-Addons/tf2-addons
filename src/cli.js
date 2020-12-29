const vorpal = require('@moleculer/vorpal')();
const Transport = require('winston-transport');
const {MESSAGE} = require('triple-beam');
const rconManager = require('./rconManager');
const gameState = require('./gameState');

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
    this.log(await gameState.getName());
    callback();
});

vorpal.command('taunts', 'Get the player taunts').action(async function(args, callback)
{
    this.log(await gameState.getTaunts());
    callback();
});

vorpal.command('setfilter', 'Set the filter to an invisible character').action(async function(args, callback)
{
    this.log(await gameState.getName());
    callback();
});

vorpal.command('echo <message...>', 'Echo test').action(async function(args, callback)
{
    await rconManager.send(`wait 1; echo "${args.message.join(' ')}                                                                                                                                                                                                                                                  tf2addons-ui"`);
    callback();
});

function onCLIReady()
{
    vorpal.delimiter('tf2addons$').show();
}

module.exports = {VorpalTransport, vorpal, onCLIReady};

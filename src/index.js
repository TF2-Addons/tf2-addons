const rconManager = require('./rconManager');
const {updateLocalizations} = require('./updateLocalizations');
const consoleParse = require('./consoleParse');
const syncClient = require('./syncClient');
const logger = require('./logger');
const {onCLIReady} = require('./cli/vorpalManager');
require('./cli/commands');
const gameState = require('./gameState');

(async () =>
{
    try
    {
        await rconManager.connect('localhost', 27015, 'tf2addons');
    }
    catch(e)
    {
        logger.error('Could not connect to rcon. Make sure TF2 is running with the right arguments');
        return;
    }
    logger.info('Finished connecting to rcon');
    
    const replacements = await updateLocalizations();
    logger.info('Updated localizations');
    
    await syncClient.connect('wss://tf2addons.techchrism.me');
    let killStarted = null;
    syncClient.on('data', async data =>
    {
        if(data.action)
        {
            logger.info(`Got action from sync server: ${data.action}`);
        }
        if(killStarted !== null)
        {
            logger.info(`Took ${Date.now() - killStarted}ms for kill sync response`);
            killStarted = null;
        }
    
        const started = Date.now();
        if(data.action === 'taunt')
        {
            await rconManager.send('-attack; taunt');
        }
        else if(data.action === 'kill')
        {
            await rconManager.send('kill');
        }
        logger.info(`Took ${Date.now() - started}ms to send ${data.action}`);
    });
    logger.info('Connected to sync server');
    
    consoleParse.begin(replacements);
    consoleParse.on('chat', message =>
    {
        logger.info(`[${message.type}] <${message.name}> ${message.message}`);
    });
    
    consoleParse.on('join', ({name}) =>
    {
        logger.info(`+ ${name}`);
    });
    
    consoleParse.on('connect', ({ip, port}) =>
    {
        logger.info(`Connected to ${ip}:${port}`);
    });
    
    consoleParse.on('addon-data', ({full, data}) =>
    {
        logger.info(`Got addon data ${full}`);
        if(data[0] === 'taunt')
        {
            syncClient.send({action: 'taunt'});
        }
        else if(data[0] === 'tauntkill')
        {
            syncClient.send({action: 'tauntkill', timeout: data[1]});
        }
    });
    
    gameState.on('player-join', player =>
    {
        logger.info(`Join: ${player.name}`);
    });
    gameState.on('player-leave', player =>
    {
        logger.info(`Leave: ${player.name}`);
    });
    gameState.beginMonitor();
    
    //TODO add option
    const syncTauntOnKill = true;
    if(syncTauntOnKill)
    {
        const name = await gameState.getName();
        consoleParse.on('kill', ({killer, killed}) =>
        {
            if(killer === name)
            {
                killStarted = Date.now();
                logger.info(`Killed ${killed} at ${killStarted}`);
                syncClient.send({action: 'taunt'});
            }
        });
    }
    
    onCLIReady();
})();

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
    //await rconManager.send('con_filter_enable 1');
    //await rconManager.send('con_filter_text "tf2addons-ui"');
    //await rconManager.send('developer 1');
    
    const replacements = await updateLocalizations();
    logger.info('Updated localizations');
    
    await syncClient.connect('wss://tf2addons.techchrism.me');
    syncClient.on('data', data =>
    {
        if(data.action)
        {
            logger.info(`Got action from sync server: ${data.action}`);
        }
        
        if(data.action === 'taunt')
        {
            rconManager.send('-attack');
            rconManager.send('taunt');
        }
        else if(data.action === 'kill')
        {
            rconManager.send('kill');
        }
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
    
    //TODO add option
    const syncTauntOnKill = true;
    if(syncTauntOnKill)
    {
        const name = await gameState.getName();
        consoleParse.on('kill', ({killer}) =>
        {
            if(killer === name)
            {
                syncClient.send({action: 'taunt'});
            }
        });
    }
    
    onCLIReady();
})();

const rconManager = require('./rconManager');
const updateLocalizations = require('./updateLocalizations');
const consoleParse = require('./consoleParse');
const syncClient = require('./syncClient');
const logger = require('./logger');

(async () =>
{
    await rconManager.connect('localhost', 27015, 'tf2addons');
    logger.info('Finished connecting to rcon');
    
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
})();

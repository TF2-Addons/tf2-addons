const rconManager = require('./rconManager');
const {updateLocalizations} = require('./updateLocalizations');
const consoleParse = require('./consoleParse');
const syncClient = require('./syncClient');
const logger = require('./logger');
//const {onCLIReady} = require('./cli/vorpalManager');
//require('./cli/commands');
const gameState = require('./gameState');
const {dataToDisplay} = require('./cli/blessedManager');

(async () =>
{
    try
    {
        await rconManager.connect('127.0.0.1', 27015, 'tf2addons');
    }
    catch(e)
    {
        logger.error('Could not connect to rcon. Make sure TF2 is running with the right arguments');
        return;
    }
    rconManager.on('disconnect', () =>
    {
        logger.error('Disconnected from rcon!');
    });
    rconManager.on('error', err =>
    {
        logger.error('Rcon error!', err);
    });
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
            // Check if too far away to taunt
            if(Array.isArray(data.position))
            {
                if(gameState.pos === null)
                {
                    logger.warn('Unable to taunt - position was null');
                }
                else
                {
                    const distance = Math.sqrt(
                        Math.pow(data.position[0] - gameState.pos.pos[0], 2) +
                        Math.pow(data.position[1] - gameState.pos.pos[1], 2) +
                        Math.pow(3 * (data.position[2] - gameState.pos.pos[2]), 2));
                    if(isNaN(distance))
                    {
                        logger.warn(`Invalid distance! data.position: ${JSON.stringify(data.position)}  gamestate: ${JSON.stringify(gameState.pos.pos)}`)
                    }
                    const minDistance = 450;
                    logger.info(`Distance from taunt source was ${distance} (${distance <= minDistance ? 'good' : 'far'})`);
                    if(distance <= minDistance)
                    {
                        await rconManager.send('-attack; taunt');
                    }
                }
            }
            else
            {
                await rconManager.send('-attack; taunt');
            }
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
    gameState.on('pos', pos =>
    {
        dataToDisplay.pos = pos.pos;
        dataToDisplay.ang = pos.ang;
        dataToDisplay.lastPosUpdate = Date.now();
    });
    gameState.on('players', players =>
    {
        dataToDisplay.players = players;
        dataToDisplay.lastPlayersUpdate = Date.now();
    });
    gameState.on('status', status =>
    {
        dataToDisplay.status = status;
        dataToDisplay.lastStatusUpdate = Date.now();
    });
    gameState.beginMonitor();

    //TODO add option
    const syncTauntOnKill = true;
    if(syncTauntOnKill)
    {
        const name = await gameState.getName();
        logger.info(`Got name as "${name}"`);
        consoleParse.on('kill', ({killer, killed}) =>
        {
            if(killer === name)
            {
                killStarted = Date.now();
                logger.info(`Killed ${killed} at ${killStarted} (pos: ${gameState.pos.pos})`);
                syncClient.send({action: 'taunt', position: gameState.pos.pos});
            }
        });
    }
})();

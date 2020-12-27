const rconManager = require('./rconManager');

async function getName()
{
    const nameLine = (await rconManager.send('name')).split('\n')[0];
    return nameLine.substring(10, nameLine.length - 20);
}

async function getTaunts()
{
    const lines = (await rconManager.send('taunt_by_name')).split('\n');
    return lines.splice(2, lines.length - 3);
}

module.exports = {getName, getTaunts};

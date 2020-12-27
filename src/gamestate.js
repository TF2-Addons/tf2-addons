const rconManager = require('./rconManager');

async function getName()
{
    const nameLine = (await rconManager.send('name')).split('\n')[0];
    return nameLine.substring(10, nameLine.length - 20);
}

module.exports = {getName};

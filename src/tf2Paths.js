const os = require('os');
const path = require('path');

function getBasePath()
{
    if(os.platform() === 'win32')
    {
        return path.join(process.env['ProgramFiles(x86)'], 'Steam', 'steamapps', 'common', 'Team Fortress 2', 'tf');
    }
    else if (os.platform() === 'linux')
    {
        return path.join(process.env['HOME'], '.steam', 'steam', 'steamapps', 'common', 'Team Fortress 2', 'tf');
    }
    else
    {
        throw new Error(`Unsupported platform: ${os.platform()}`);
    }
}

const basePath = getBasePath();
module.exports = {
    base: basePath,
    log: path.join(basePath, 'console.log'),
    resource: path.join(basePath, 'resource')
};

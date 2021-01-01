const blessed = require('blessed');
const prettyMilliseconds = require('pretty-ms');
const Transport = require('winston-transport');
const {MESSAGE} = require('triple-beam');

const screen = blessed.screen({
    smartCSR: true
});
screen.title = 'TF2 Addons';
const log = blessed.log({
    width: '70%',
    height: '100%',
    tags: true,
    border: {
        type: 'line'
    },
    label: 'Log'
});
screen.append(log);

const dataDisplay = blessed.box({
    left: '70%',
    width: '30%',
    height: '100%',
    content: 'bruh',
    tags: true,
    border: {
        type: 'line'
    },
    label: 'Data'
});
screen.append(dataDisplay);


screen.render();
screen.key(['escape', 'q', 'C-c'], (ch, key) =>
{
    return process.exit(0);
});

const dataToDisplay = {
    pos: [],
    ang: [],
    lastPosUpdate: null,
    players: [],
    lastPlayersUpdate: null,
    status: null,
    lastStatusUpdate: null
};
function renderDisplay()
{
    const lines = [];
    lines.push('{bold}Position Data{/bold}');
    lines.push(`Position: ${dataToDisplay.pos.join(', ')}`);
    lines.push(`Angle: ${dataToDisplay.pos.join(', ')}`);
    if(dataToDisplay.lastPosUpdate !== null)
    {
        lines.push(`Last pos update: ${prettyMilliseconds(Date.now() - dataToDisplay.lastPosUpdate)} ago`);
    }
    lines.push('');
    lines.push('{bold}Status Data{/bold}');
    if(dataToDisplay.status !== null)
    {
        for(const label in dataToDisplay.status)
        {
            if(!dataToDisplay.status.hasOwnProperty(label))
            {
                continue;
            }
            lines.push(`${label}: ${dataToDisplay.status[label]}`);
        }
        if(dataToDisplay.lastPosUpdate !== null)
        {
            lines.push(`Last status update: ${prettyMilliseconds(Date.now() - dataToDisplay.lastStatusUpdate)} ago`);
        }
    }
    dataDisplay.setContent(lines.join('\n'));
    screen.render();
}
setInterval(() =>
{
    renderDisplay();
}, 250);

class BlessedTransport extends Transport
{
    constructor(opts)
    {
        super(opts);
    }
    
    log(info, callback)
    {
        setImmediate(() => this.emit('logged', info));
        
        log.log(info[MESSAGE]);
        callback();
    }
}

module.exports = {screen, dataToDisplay, BlessedTransport};

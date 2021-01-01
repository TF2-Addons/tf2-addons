const vorpal = require('@moleculer/vorpal')();
const Transport = require('winston-transport');
const {MESSAGE} = require('triple-beam');

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

function onCLIReady()
{
    vorpal.delimiter('tf2addons$').show();
}

module.exports = {VorpalTransport, vorpal, onCLIReady};

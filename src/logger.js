const {createLogger, format, transports} = require('winston');
const {combine, timestamp, printf} = format;
require('winston-daily-rotate-file');
const {BlessedTransport} = require('./cli/blessedManager');

const fileTransport = new (transports.DailyRotateFile)({
    filename: '%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    dirname: 'logs'
});
const myFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});
const logger = createLogger({
    format: combine(
        timestamp(),
        myFormat
    ),
    transports: [
        new BlessedTransport(),
        fileTransport
    ]
});

module.exports = logger;

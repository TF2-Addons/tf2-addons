const {createLogger, format, transports} = require('winston');
const {combine, timestamp, printf} = format;
require('winston-daily-rotate-file');
const {VorpalTransport} = require('./cli');

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
        new VorpalTransport(),
        fileTransport
    ]
});

module.exports = logger;

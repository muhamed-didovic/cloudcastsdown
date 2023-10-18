import debug from "debug";

const appName: string = 'scraper';
const logLevels: string[] = ['error', 'warn', 'info', 'debug', 'log'];

export const logger: any = {};
logLevels.forEach((logLevel: string) => {
    logger[logLevel] = debug(`${appName}:${logLevel}`);
});

export default logger;
// module.exports = logger

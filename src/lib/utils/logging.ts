/**
 * @fileoverview Handle logging for Sonar (based on ESLint)
 */

/* eslint no-console: "off" */

/* istanbul ignore next */

/** Cover for console.error */
export const error = (message: any, service: string, ...optionalParams: Array<any>) => {
    console.error(`[${new Date().toISOString()}] [${service}] ${message.toString()}`, ...optionalParams);
};

/** Cover for console.log */
export const log = (message: any, service?: string, ...optionalParams: Array<any>) => {
    if (!service) {
        console.log(message);
    } else {
        console.log(`[${new Date().toISOString()}] [${service}] ${message.toString()}`, ...optionalParams);
    }
};

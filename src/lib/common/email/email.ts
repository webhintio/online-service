import { promisify } from 'util';

import * as nodemailer from 'nodemailer';
import * as tri from 'tri';

import * as logger from '../../utils/logging';

const moduleName = 'Email';
const { emailUser: user, emailPassword: password, smtpHost, smtpPort, emailFrom, emailTo } = process.env; // eslint-disable-line no-process-env

/**
 * Convert an string comma separated into an Array.
 * @param {string} stringToConvert String comma separated
 */
const stringToArray = (stringToConvert: string): Array<string> => {
    if (!stringToConvert) {
        return [];
    }
    const stringSplit = stringToConvert.split(',');

    return stringSplit;
};

/**
 * Wrapper for nodemailer to send emails.
 */
export class Email {
    private transporter;
    private config = {
        auth: {
            pass: password,
            user
        },
        host: smtpHost,
        port: smtpPort,
        secure: true
    }
    private from: string = emailFrom;
    private to: Array<string> = stringToArray(emailTo);
    private sendMail;

    public constructor() {
        if (this.config.host) {
            this.transporter = nodemailer.createTransport(this.config);
            this.sendMail = promisify(this.transporter.sendMail.bind(this.transporter));
        }
    }

    /**
     * Send an email.
     * @param options Options for the email.
     */
    public async send(options) {
        if (!this.transporter) {
            logger.log('The email account is not configured', moduleName);

            return null;
        }

        options.from = this.from;
        options.to = this.to;

        try {
            const result = await tri(() => {
                return this.sendMail(options);
            }, {
                delay: 500,
                maxAttempts: 10
            });

            return result;
        } catch (err) {
            logger.error(`Error sending email to ${options.to}`, moduleName);

            return null;
        }
    }
}

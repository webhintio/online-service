import { promisify } from 'util';

import * as nodemailer from 'nodemailer';

import * as logger from '../../utils/logging';

const moduleName = 'Email';
const { emailUser: user, emailPassword: password, smtpHost, smtpPort, emailFrom, emailTo } = process.env; // eslint-disable-line no-process-env

const stringToArray = (stringToConvert: string) => {
    if (!stringToConvert) {
        return [];
    }
    const stringSplit = stringToConvert.split(',');

    return stringSplit;
};

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

    public send(options) {
        if (!this.transporter) {
            logger.log('The email account is not configured', moduleName);

            return null;
        }

        options.from = this.from;
        options.to = this.to;

        return this.sendMail(options);
    }
}

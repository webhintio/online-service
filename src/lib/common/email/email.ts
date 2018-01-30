import { promisify } from 'util';

import * as tri from 'tri';
import * as request from 'request';

import * as logger from '../../utils/logging';

const moduleName = 'Email';
const { emailApikey: apikey, emailFrom, emailUrl } = process.env; // eslint-disable-line no-process-env
const postAsync = promisify(request.post);

/**
 * Wrapper for emails.
 */
export class Email {
    private apikey: string = apikey;
    private from: string = emailFrom;
    private sendMail;
    private url: string = emailUrl;

    public constructor() {
    }

    /**
     * Send an email.
     * @param subject - Email subject.
     * @param content - Email content.
     */
    public async send(subject: string, content: string) {
        if (!this.url) {
            logger.log('The email account is not configured', moduleName);

            return null;
        }

        try {
            const result = await tri(async () => {
                const r = await postAsync(this.url, {
                    form: {
                        apikey: this.apikey,
                        bodyText: content,
                        msgFrom: this.from,
                        segments: '0',
                        subject
                    },
                    json: true
                });

                if (!r.body.success) {
                    throw new Error(r.body.error);
                }
            }, {
                delay: 500,
                maxAttempts: 10
            });

            logger.log(`Email sent.`, moduleName);

            return result;
        } catch (err) {
            logger.error(`Error sending email.`, moduleName, err);

            return null;
        }
    }
}

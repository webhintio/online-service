import NtpTimeSync from 'ntp-time-sync';
import * as tri from 'tri';

const options = {
    servers: [
        '0.us.pool.ntp.org',
        '1.us.pool.ntp.org',
        '2.us.pool.ntp.org',
        'time-a-g.nist.gov',
        'time-a-wwv.nist.gov',
        'time-a-b.nist.gov'
    ]
};
const timeSync = NtpTimeSync.getInstance(options);

export const getTime = async (): Promise<Date> => {
    let time;

    try {
        const timeObject = await tri(timeSync.getTime.bind(timeSync), {
            delay: 500,
            maxAttempts: 10
        });

        time = timeObject.now;
    } catch (err) {
        time = null;
    }

    return time;
};

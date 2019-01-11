import * as ntp from '@destinationstransfers/ntp';
import * as tri from 'tri';

const options = { server: 'time-a-g.nist.gov' };

export const getTime = async (): Promise<Date> => {
    let time;

    try {
        time = await tri(() => {
            return ntp.getNetworkTime(options);
        }, {
            delay: 500,
            maxAttempts: 10
        });
    } catch (err) {
        time = null;
    }

    return time;
};

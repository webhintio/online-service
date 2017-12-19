import NtpTimeSync from 'ntp-time-sync';

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
    return (await timeSync.getTime()).now;
};

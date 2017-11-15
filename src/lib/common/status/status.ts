import * as moment from 'moment';
import * as db from '../../common/database/database';
import { IStatusModel } from '../database/models/status';
import { IJob, IStatus, StatusAverage, StatusFinished, StatusScans, StatusQueue } from '../../types';
import { JobStatus } from '../../enums/status';
import { Queue } from '../queue/queue';
import * as database from '../database/database';
import * as logger from '../../utils/logging';

const moduleName: string = 'Status service';
const { database: dbConnectionString, queue: queueConnectionString } = process.env; // eslint-disable-line no-process-env
let queueJobs: Queue;
let queueResults: Queue;
const updateTimeout = 15 * 60 * 1000; // 15 minutes.
const cache: Map<string, IStatus> = new Map();
// The last item '60' it is just for simplicity.
const quarters: Array<number> = [0, 15, 30, 45, 60];

class Status implements IStatus {
    public average: StatusAverage;
    public date: Date;
    public queues: StatusQueue;
    public scans: StatusScans;

    public constructor(status: IStatus) {
        this.average = status.average;
        this.date = status.date;
        this.queues = status.queues;
        this.scans = status.scans;
    }
}

/**
 * Calculate the time average in an array of jobs.
 * @param {Array<IJob>} jobs - Jobs to calculate the average.
 * @param {string} fieldEnd - First field to calculate the average.
 * @param {string} fieldStart - Second field to calculate the average.
 */
const average = (jobs: Array<IJob>, fieldEnd: string, fieldStart: string): number => {
    if (jobs.length === 0) {
        // QUESTION: return null or return 0?
        return null;
    }

    const acc = jobs.reduce((total: number, job: IJob) => {
        return total + (job[fieldEnd].getTime() - job[fieldStart].getTime());
    }, 0);

    return acc / jobs.length;
};

/**
 * Split finished jobs in `error` or `success`.
 * @param {Array<IJob>} jobs - Array of jobs.
 */
const getFinishedByStatus = (jobs: Array<IJob>): StatusFinished => {
    return jobs.reduce((total: StatusFinished, job: IJob) => {
        if (job.status === JobStatus.error) {
            total.error++;
        } else {
            total.success++;
        }

        return total;
    },
        {
            error: 0,
            success: 0
        });
};

/**
 * Update the statuses since a date.
 * @param {Date} since - Date to start calculating the statuses.
 */
const updateStatusesSince = async (since: Date) => {
    let from = moment(since);
    let to = moment(from).add(15, 'm');
    let last: IStatusModel;

    while (to.isBefore(moment())) {
        const now: number = Date.now();
        const [jobsCreated, jobsStarted, jobsFinished]: [Array<IJob>, Array<IJob>, Array<IJob>] = await Promise.all([
            db.getJobsByDate('queued', from.toDate(), to.toDate()),
            db.getJobsByDate('started', from.toDate(), to.toDate()),
            db.getJobsByDate('finished', from.toDate(), to.toDate())
        ]);

        // TODO: remove this line
        console.log(`Database request time: ${Date.now() - now}ms`);

        logger.log(`Found: ${jobsCreated.length} jobs created from ${from.toISOString()} to ${to.toISOString()}`, moduleName);
        logger.log(`Found: ${jobsCreated.length} jobs started from ${from.toISOString()} to ${to.toISOString()}`, moduleName);
        logger.log(`Found: ${jobsFinished.length} jobs finished from ${from.toISOString()} to ${to.toISOString()}`, moduleName);

        const result: IStatus = {
            average: {
                finish: average(jobsFinished, 'finished', 'started'),
                start: average(jobsStarted, 'started', 'queued')
            },
            date: to.toDate(),
            queues: null,
            scans: {
                created: jobsCreated.length,
                finished: getFinishedByStatus(jobsFinished),
                started: jobsStarted.length
            }
        };

        last = await database.addStatus(result);


        from = to;
        to = moment(from).add(15, 'm');
    }

    if (last) {
        const [messagesJobs, messagesResults]: [number, number] = await Promise.all([
            queueJobs.getMessagesCount(),
            queueResults.getMessagesCount()
        ]);

        last.queues = {
            jobs: messagesJobs,
            results: messagesResults
        };

        await database.updateStatus(last, 'queues');
    }
};

/**
 * Update the scanner status.
 */
const updateStatuses = async () => {
    await db.connect(dbConnectionString);
    if (!queueJobs) {
        queueJobs = new Queue('sonar-jobs', queueConnectionString);
    }

    if (!queueResults) {
        queueResults = new Queue('sonar-results', queueConnectionString);
    }

    const lastStatus: IStatus = await db.getMostRecentStatus();
    // Any date before the online scanner exists.
    let since: Date = moment('2017-10-15').toDate();

    if (lastStatus) {
        since = lastStatus.date;
    }

    logger.log(`Updating status since: ${since.toISOString()}`);
    await updateStatusesSince(since);
    logger.log(`Status database updated`);

    setTimeout(updateStatuses, updateTimeout);
};

/**
 * Calculate the closest quarter of an hour.
 * @param {Date} date Date calculate the closest quarter of an hour
 */
const getCloserQuarter = (date: Date): moment.Moment => {
    const d: moment.Moment = moment(date);
    const currentMinute: number = d.minutes();
    let i: number = 0;
    let nextQuarter: number = quarters[i + 1];

    while (currentMinute >= nextQuarter && nextQuarter !== quarters[quarters.length - 1]) {
        i++;
        nextQuarter = quarters[i + 1];
    }

    return d.minutes(quarters[i]).startOf('minute');
};

/**
 * Get the online scanner status.
 * @param {Date} from - Time since we want to get results.
 * @param {Date} to - Time until we want to get results.
 */
export const getStatus = async (from: Date = new Date(), to: Date = new Date()): Promise<Array<IStatus>> => {
    const fromQuarter: moment.Moment = getCloserQuarter(from);
    const toQuarter: moment.Moment = getCloserQuarter(to);
    const result: Array<IStatus> = [];

    while (fromQuarter.isSameOrBefore(toQuarter)) {
        const isoString = fromQuarter.toISOString();

        if (!cache.has(isoString)) {
            const newValue: IStatus = await database.getStatusByDate(fromQuarter.toDate());

            cache.set(isoString, new Status(newValue));
        }

        result.push(cache.get(isoString));

        fromQuarter.add(15, 'm');
    }

    return result;
};

if (dbConnectionString) {
    updateStatuses();
}

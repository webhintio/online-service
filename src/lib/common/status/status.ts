import * as moment from 'moment';
import * as _ from 'lodash';
import { Severity } from 'hint/dist/src/lib/types';

import * as db from '../database/database';
import { IStatusModel } from '../database/models/status';
import { IJob, IStatus, IStatusHintDetail, IStatusHints, IStatusUrl, Hint, StatusAverage, StatusFinished, StatusHintDetailList, StatusScans, StatusQueue } from '../../types';
import { JobStatus, HintStatus } from '../../enums/status';
import { Queue } from '../queue/queue';
import * as logger from '../../utils/logging';

const moduleName: string = 'Status service';
const { database: dbConnectionString, queue: queueConnectionString } = process.env; // eslint-disable-line no-process-env
let queueJobs: Queue;
let queueResults: Queue;

class StatusHints implements IStatusHints {
    public errors: number;
    public passes: number;
    public warnings: number;
    public hints: StatusHintDetailList;

    public constructor() {
        this.errors = 0;
        this.passes = 0;
        this.warnings = 0;
        this.hints = {};
    }
}

class Status implements IStatus {
    public average: StatusAverage;
    public date: Date;
    public queues: StatusQueue;
    public scans: StatusScans;
    public hints: StatusHints;

    public constructor(status: IStatus) {
        this.average = status.average;
        this.date = status.date;
        this.queues = status.queues;
        this.hints = status.hints;
        this.scans = status.scans;
    }
}

class StatusUrl implements IStatusUrl {
    public errors: number;
    public passes: number;
    public warnings: number;
    public url: string;

    public constructor(url: string) {
        this.errors = 0;
        this.passes = 0;
        this.warnings = 0;
        this.url = url;
    }
}

class StatusHintDetail implements IStatusHintDetail {
    public errors: number;
    public passes: number;
    public warnings: number;
    public urls: Array<IStatusUrl>;

    public constructor() {
        this.errors = 0;
        this.passes = 0;
        this.urls = [];
        this.warnings = 0;
    }
}

/**
 * Calculate the average time in an array of jobs.
 * @param {Array<IJob>} jobs - Jobs to calculate the average.
 * @param {string} fieldEnd - First field to calculate the average.
 * @param {string} fieldStart - Second field to calculate the average.
 */
const avg = (jobs: Array<IJob>, fieldEnd: string, fieldStart: string): number => {
    if (jobs.length === 0) {
        return null;
    }

    const acc = jobs.reduce((total: number, job: IJob) => {
        let field;

        if (!job[fieldEnd]) {
            field = fieldEnd;
        } else if (!job[fieldStart]) {
            field = fieldStart;
        }

        if (field) {
            console.log(`Field: ${field} doesn't exists in job ${job.id}`);
        }

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
 * Set the number of errors and warnings in a hint.
 * @param {StatusUrl} url - Url status where we want to set the number of errors and warnings.
 * @param {Hint} hint - Hint with the error messages.
 */
const setUrlCounts = (url: StatusUrl, hint: Hint) => {
    const messagesGrouped = _.groupBy(hint.messages, 'severity');
    const errors = messagesGrouped[Severity.error.toString()];
    const warnings = messagesGrouped[Severity.warning.toString()];

    url.errors = errors ? errors.length : 0;
    url.warnings = warnings ? warnings.length : 0;
};

/**
 * Get the status of the hints in a collection of IJobs.
 * @param {Array<IJob>} jobs -Jobs to get the Status of the hints.
 */
const getHintsStatus = (jobs: Array<IJob>) => {
    const result: IStatusHints = new StatusHints();

    jobs.reduce((total, job) => {
        const hints: Array<Hint> = job.hints.length > 0 ? job.hints : job.rules;

        hints.forEach((hint) => {
            let detail: IStatusHintDetail = total.hints[hint.name];

            if (!detail) {
                detail = new StatusHintDetail();

                total.hints[hint.name] = detail;
            }

            const url = new StatusUrl(job.url);

            detail.urls.push(url);

            switch (hint.status) {
                case HintStatus.pass:
                    url.passes++;
                    detail.passes++;
                    total.passes++;
                    break;
                case HintStatus.error: {
                    setUrlCounts(url, hint);

                    detail.errors++;
                    total.errors++;
                    break;
                }
                case HintStatus.warning:
                    setUrlCounts(url, hint);
                    detail.warnings++;
                    total.warnings++;
                    break;
                default:
                    break;
            }
        });

        return total;
    }, result);

    return result;
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
        const fromDate = from.toDate();
        const toDate = to.toDate();

        const [jobsCreated, jobsStarted, jobsFinished]: [Array<IJob>, Array<IJob>, Array<IJob>] = await Promise.all([
            db.job.getByDate('queued', fromDate, toDate),
            db.job.getByDate('started', fromDate, toDate),
            db.job.getByDate('finished', fromDate, toDate)
        ]);

        logger.log(`Found: ${jobsCreated.length} jobs created from ${from.toISOString()} to ${to.toISOString()}`, moduleName);
        logger.log(`Found: ${jobsStarted.length} jobs started from ${from.toISOString()} to ${to.toISOString()}`, moduleName);
        logger.log(`Found: ${jobsFinished.length} jobs finished from ${from.toISOString()} to ${to.toISOString()}`, moduleName);

        const result: IStatus = {
            average: {
                finish: avg(jobsFinished, 'finished', 'started'),
                start: avg(jobsStarted, 'started', 'queued')
            },
            date: to.toDate(),
            hints: getHintsStatus(jobsFinished),
            queues: null,
            scans: {
                created: jobsCreated.length,
                finished: getFinishedByStatus(jobsFinished),
                started: jobsStarted.length
            }
        };

        last = await db.status.add(result);

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

        await db.status.update(last, 'queues');
    }
};

/**
 * Update the scanner status.
 */
export const updateStatuses = async () => {
    await db.connect(dbConnectionString);
    if (!queueJobs) {
        queueJobs = new Queue('webhint-jobs', queueConnectionString);
    }

    if (!queueResults) {
        queueResults = new Queue('webhint-results', queueConnectionString);
    }

    const lastStatus: IStatus = await db.status.getMostRecent();
    // Online scanner was published in this date, no results before.
    let since: Date = moment('2017-10-15').toDate();

    if (lastStatus) {
        since = lastStatus.date;
    }

    logger.log(`Updating status since: ${since.toISOString()}`);
    await updateStatusesSince(since);
    logger.log(`Status database updated`);
};

/**
 * Calculate the closest quarter of an hour.
 * @param {Date} date - Date to calculate the closest quarter of an hour.
 */
const getCloserQuarter = (date: Date): moment.Moment => {
    const d: moment.Moment = moment(date);
    const currentMinute: number = d.minutes();

    return d.minutes(Math.floor(currentMinute / 15) * 15).startOf('minute');
};

/**
 * Get the online scanner status.
 * @param {Date} from - Time since we want to get results.
 * @param {Date} to - Time until we want to get results.
 */
export const getStatus = async (from: Date = new Date(), to: Date = new Date()): Promise<Array<IStatus>> => {
    const fromQuarter: Date = getCloserQuarter(from).toDate();
    const toQuarter: Date = getCloserQuarter(to).toDate();
    const result: Array<IStatus> = await db.status.getByDate(fromQuarter, toQuarter);

    return result.map((status) => {
        return new Status(status);
    });
};

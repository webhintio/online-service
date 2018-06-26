import * as moment from 'moment';
import * as _ from 'lodash';
import { Severity } from 'sonarwhal/dist/src/lib/types';

import * as db from '../database/database';
import { IStatusModel } from '../database/models/status';
import { IJob, IStatus, IStatusRuleDetail, IStatusRules, IStatusUrl, Rule, StatusAverage, StatusFinished, StatusRuleDetailList, StatusScans, StatusQueue } from '../../types';
import { JobStatus, RuleStatus } from '../../enums/status';
import { Queue } from '../queue/queue';
import * as logger from '../../utils/logging';

const moduleName: string = 'Status service';
const { database: dbConnectionString, queue: queueConnectionString } = process.env; // eslint-disable-line no-process-env
let queueJobs: Queue;
let queueResults: Queue;

class StatusRules implements IStatusRules {
    public errors: number;
    public passes: number;
    public warnings: number;
    public rules: StatusRuleDetailList;

    public constructor() {
        this.errors = 0;
        this.passes = 0;
        this.warnings = 0;
        this.rules = {};
    }
}

class Status implements IStatus {
    public average: StatusAverage;
    public date: Date;
    public queues: StatusQueue;
    public scans: StatusScans;
    public rules: StatusRules;

    public constructor(status: IStatus) {
        this.average = status.average;
        this.date = status.date;
        this.queues = status.queues;
        this.rules = status.rules;
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

class StatusRuleDetail implements IStatusRuleDetail {
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
 * Set the number of errors and warnings in a rule.
 * @param {StatusUrl} url - Url status where we want to set the number of errors and warnings.
 * @param {Rule} rule - Rule with the error messages.
 */
const setUrlCounts = (url: StatusUrl, rule: Rule) => {
    const messagesGrouped = _.groupBy(rule.messages, 'severity');
    const errors = messagesGrouped[Severity.error.toString()];
    const warnings = messagesGrouped[Severity.warning.toString()];

    url.errors = errors ? errors.length : 0;
    url.warnings = warnings ? warnings.length : 0;
};

/**
 * Get the status of the rules in a collection of IJobs.
 * @param {Array<IJob>} jobs -Jobs to get the Status of the rules.
 */
const getRulesStatus = (jobs: Array<IJob>) => {
    const result: IStatusRules = new StatusRules();

    jobs.reduce((total, job) => {
        job.rules.forEach((rule) => {
            let detail: IStatusRuleDetail = total.rules[rule.name];

            if (!detail) {
                detail = new StatusRuleDetail();

                total.rules[rule.name] = detail;
            }

            const url = new StatusUrl(job.url);

            detail.urls.push(url);

            switch (rule.status) {
                case RuleStatus.pass:
                    url.passes++;
                    detail.passes++;
                    total.passes++;
                    break;
                case RuleStatus.error: {
                    setUrlCounts(url, rule);

                    detail.errors++;
                    total.errors++;
                    break;
                }
                case RuleStatus.warning:
                    setUrlCounts(url, rule);
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
            queues: null,
            rules: getRulesStatus(jobsFinished),
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
        queueJobs = new Queue('sonar-jobs', queueConnectionString);
    }

    if (!queueResults) {
        queueResults = new Queue('sonar-results', queueConnectionString);
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

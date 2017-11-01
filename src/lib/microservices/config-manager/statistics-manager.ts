import * as moment from 'moment';
import * as database from '../../common/database/database';
import { Statistics } from '../../types';
import { JobStatus } from '../../enums/status';

/**
 * Get the database basic information.
 * # of scans
 * # of scans in the last hour
 * # of items in each status
 * # of errors and jobs finished in the last hour
 */
export const info = async (): Promise<Statistics> => {
    const anHourAgo = moment()
        .subtract(1, 'hour')
        .toDate();

    const promises = [
        database.getJobsCount(),
        database.getJobsCount({ since: anHourAgo }),
        database.getStatusCount(JobStatus.error),
        database.getStatusCount(JobStatus.finished),
        database.getStatusCount(JobStatus.pending),
        database.getStatusCount(JobStatus.started),
        database.getStatusCount(JobStatus.error, {
            field: 'finished',
            since: anHourAgo
        }),
        database.getStatusCount(JobStatus.finished, {
            field: 'finished',
            since: anHourAgo
        })
    ];

    const [
        scans,
        scansLastHour,
        statusError,
        statusFinished,
        statusPending,
        statusStarted,
        statusErrorLastHour,
        statusFinishedLastHour
    ] = await Promise.all(promises);

    return {
        scans,
        scansLastHour,
        status: {
            error: statusError,
            finished: statusFinished,
            pending: statusPending,
            started: statusStarted
        },
        statusLastHour: {
            error: statusErrorLastHour,
            finished: statusFinishedLastHour
        }
    };
};

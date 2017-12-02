import * as moment from 'moment';
import * as db from '../../common/database/database';
import { Stat } from '../../types';
import { JobStatus } from '../../enums/status';

/**
 * Get the database basic information.
 * # of scans
 * # of scans in the last hour
 * # of items in each status
 * # of errors and jobs finished in the last hour
 */
export const info = async (): Promise<Stat> => {
    const anHourAgo = moment()
        .subtract(1, 'hour')
        .toDate();

    const promises = [
        db.job.getCount(),
        db.job.getCount({ since: anHourAgo }),
        db.job.getStatusCount(JobStatus.error),
        db.job.getStatusCount(JobStatus.finished),
        db.job.getStatusCount(JobStatus.pending),
        db.job.getStatusCount(JobStatus.started),
        db.job.getStatusCount(JobStatus.error, {
            field: 'finished',
            since: anHourAgo
        }),
        db.job.getStatusCount(JobStatus.finished, {
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
        date: null,
        resultsQueue: null,
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
        },
        syncQueue: null
    };
};

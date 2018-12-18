import test, { ExecutionContext } from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as moment from 'moment';
import * as _ from 'lodash';

import { IStatus } from '../../../../src/lib/types';
import { job as validJob } from './fixtures/job';

const validStatus: IStatus = {
    average: {
        finish: null,
        start: null
    },
    date: new Date('2017-10-15T08:15:00.000Z'),
    hints: null,
    queues: null,
    scans: {
        created: 0,
        finished: {
            error: 0,
            success: 0
        },
        started: 0
    }
};

const database = {
    connect() { },
    job: { getByDate(field: string, fromDate: Date, toDate: Date) { } },
    status: {
        add() { },
        getByDate(fromQuarter: moment.Moment, toQuarter: moment.Moment) { },
        getMostRecent() { },
        update() { }
    }
};

const queueMethods = { getMessagesCount() { } };

const Queue = function () {
    return queueMethods;
};

const queueObject = { Queue };

process.env.database = 'Database connection string'; // eslint-disable-line no-process-env
process.env.queue = 'Queue connection string'; // eslint-disable-line no-process-env

type StatusTestContext = {
    sandbox: sinon.SinonSandbox;
    databaseStatusAddStub: sinon.SinonStub;
    databaseStatusUpdateStub: sinon.SinonStub;
};

type TestContext = ExecutionContext<StatusTestContext>;

proxyquire('../../../../src/lib/common/status/status', {
    '../database/database': database,
    '../queue/queue': queueObject
});

import * as status from '../../../../src/lib/common/status/status';

test.beforeEach((t: TestContext) => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(database, 'connect').resolves();
    t.context.databaseStatusAddStub = sandbox.stub(database.status, 'add').resolves(validStatus);
    t.context.databaseStatusUpdateStub = sandbox.stub(database.status, 'update').resolves();
    sandbox.stub(queueMethods, 'getMessagesCount').resolves();

    t.context.sandbox = sandbox;
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

test.serial('getStatus should return the items in the database between the dates (1/3)', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const databaseStatusGetByDateStub = sandbox.stub(database.status, 'getByDate').resolves([validStatus]);

    await status.getStatus(new Date('2017-10-15T08:29:59.999Z'), new Date('2017-10-15T08:30:00.000Z'));

    t.is(databaseStatusGetByDateStub.callCount, 1);

    const args = databaseStatusGetByDateStub.args;

    t.true(moment(args[0][0]).isSame(moment('2017-10-15T08:15:00.000Z')));
    t.true(moment(args[0][1]).isSame(moment('2017-10-15T08:30:00.000Z')));
});

test.serial('getStatus should return the items in the database between the dates (2/3)', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const databaseStatusGetByDateStub = sandbox.stub(database.status, 'getByDate').resolves([validStatus]);

    await status.getStatus(new Date('2017-10-15T09:15:00.000Z'), new Date('2017-10-15T09:38:00.000Z'));

    t.is(databaseStatusGetByDateStub.callCount, 1);

    const args = databaseStatusGetByDateStub.args;

    t.true(moment(args[0][0]).isSame(moment('2017-10-15T09:15:00.000Z')));
    t.true(moment(args[0][1]).isSame(moment('2017-10-15T09:30:00.000Z')));
});

test.serial('getStatus should return the items in the database between the dates (3/3)', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const databaseStatusGetByDateStub = sandbox.stub(database.status, 'getByDate').resolves([validStatus]);

    await status.getStatus(new Date('2017-10-15T10:00:00.000Z'), new Date('2017-10-15T10:59:59.999Z'));

    t.is(databaseStatusGetByDateStub.callCount, 1);

    const args = databaseStatusGetByDateStub.args;

    t.true(moment(args[0][0]).isSame(moment('2017-10-15T10:00:00.000Z')));
    t.true(moment(args[0][1]).isSame(moment('2017-10-15T10:45:00.000Z')));
});

test.serial('updateStatuses should get results every 15 minutes', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const recentDate = moment()
        .subtract(16, 'm')
        .startOf('minute');

    sandbox.stub(database.status, 'getMostRecent').resolves({ date: recentDate });
    const databaseJobGetByDate = sandbox.stub(database.job, 'getByDate').resolves([]);

    await status.updateStatuses();

    t.is(databaseJobGetByDate.callCount, 3);
    t.true(t.context.databaseStatusAddStub.calledOnce);
    t.true(t.context.databaseStatusUpdateStub.calledOnce);

    const args = databaseJobGetByDate.args;

    t.is(args[0][0], 'queued');
    t.is(args[1][0], 'started');
    t.is(args[2][0], 'finished');
});

test.serial('updateStatuses should just update the queue status for the last period of time', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const recentDate = moment()
        .subtract(31, 'm')
        .startOf('minute');

    sandbox.stub(database.status, 'getMostRecent').resolves({ date: recentDate });
    const databaseJobGetByDate = sandbox.stub(database.job, 'getByDate').resolves([]);

    await status.updateStatuses();

    t.is(databaseJobGetByDate.callCount, 6);
    t.true(t.context.databaseStatusAddStub.calledTwice);
    t.true(t.context.databaseStatusUpdateStub.calledOnce);
});

const getValidTestData = () => {
    const validJob2 = _.cloneDeep(validJob);
    const validJob3 = _.cloneDeep(validJob);

    validJob.queued = moment()
        .startOf('hour')
        .toDate();
    validJob.started = moment(validJob.queued)
        .add(1, 's')
        .toDate();
    validJob.finished = moment(validJob.started)
        .add(1, 'm')
        .toDate();

    validJob2.queued = moment()
        .startOf('hour')
        .toDate();
    validJob2.started = moment(validJob2.queued)
        .add(3, 's')
        .toDate();
    validJob2.finished = moment(validJob2.started)
        .add(1, 'm')
        .add(30, 's')
        .toDate();
    validJob2.url = 'http://www.new-url.com';

    validJob3.queued = moment()
        .startOf('hour')
        .toDate();
    validJob3.started = moment(validJob3.queued)
        .add(5, 's')
        .toDate();
    validJob3.finished = moment(validJob3.started)
        .add(2, 'm')
        .toDate();
    validJob3.hints[1].status = 'warning';

    return [validJob, validJob2, validJob3];
};

test.serial('updateStatuses should calculate the averages', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const recentDate = moment()
        .subtract(16, 'm')
        .startOf('minute');

    sandbox.stub(database.status, 'getMostRecent').resolves({ date: recentDate });
    const databaseJobGetByDate = sandbox.stub(database.job, 'getByDate').resolves(getValidTestData());

    await status.updateStatuses();

    t.is(databaseJobGetByDate.callCount, 3);
    t.true(t.context.databaseStatusAddStub.calledOnce);
    t.true(t.context.databaseStatusUpdateStub.calledOnce);

    const args = t.context.databaseStatusAddStub.args[0][0];

    t.is(args.average.start, 3000);
    t.is(args.average.finish, 90000);
});

test.serial('updateStatuses should calculate the averages if some time is missed', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const recentDate = moment()
        .subtract(16, 'm')
        .startOf('minute');

    sandbox.stub(database.status, 'getMostRecent').resolves({ date: recentDate });

    const data = getValidTestData();

    data[1].started = null;

    const databaseJobGetByDate = sandbox.stub(database.job, 'getByDate').resolves(data);

    await status.updateStatuses();

    t.is(databaseJobGetByDate.callCount, 3);
    t.true(t.context.databaseStatusAddStub.calledOnce);
    t.true(t.context.databaseStatusUpdateStub.calledOnce);

    const args = t.context.databaseStatusAddStub.args[0][0];

    t.is(args.average.start, 3000);
    t.is(args.average.finish, 90000);
});

test.serial('updateStatuses should calculate the averages if some times are equal', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const recentDate = moment()
        .subtract(16, 'm')
        .startOf('minute');

    sandbox.stub(database.status, 'getMostRecent').resolves({ date: recentDate });

    const data = getValidTestData();

    data[1].queued = data[1].started;

    const databaseJobGetByDate = sandbox.stub(database.job, 'getByDate').resolves(data);

    await status.updateStatuses();

    t.is(databaseJobGetByDate.callCount, 3);
    t.true(t.context.databaseStatusAddStub.calledOnce);
    t.true(t.context.databaseStatusUpdateStub.calledOnce);

    const args = t.context.databaseStatusAddStub.args[0][0];

    t.is(args.average.start, 3000);
    t.is(args.average.finish, 90000);
});

test.serial('updateStatuses should calculate the averages if all times are equal', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const recentDate = moment()
        .subtract(16, 'm')
        .startOf('minute');

    sandbox.stub(database.status, 'getMostRecent').resolves({ date: recentDate });

    const data = getValidTestData();

    data[0].started = data[0].queued;
    data[0].finished = data[0].queued;
    data[1].started = data[1].queued;
    data[1].finished = data[1].queued;
    data[2].started = data[2].queued;
    data[2].finished = data[2].queued;

    const databaseJobGetByDate = sandbox.stub(database.job, 'getByDate').resolves(data);

    await status.updateStatuses();

    t.is(databaseJobGetByDate.callCount, 3);
    t.true(t.context.databaseStatusAddStub.calledOnce);
    t.true(t.context.databaseStatusUpdateStub.calledOnce);

    const args = t.context.databaseStatusAddStub.args[0][0];

    t.is(args.average.start, Number.MAX_SAFE_INTEGER);
    t.is(args.average.finish, Number.MAX_SAFE_INTEGER);
});

test.serial('updateStatuses should calculate hints status', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const recentDate = moment()
        .subtract(16, 'm')
        .startOf('minute');

    sandbox.stub(database.status, 'getMostRecent').resolves({ date: recentDate });
    const databaseJobGetByDate = sandbox.stub(database.job, 'getByDate').resolves(getValidTestData());

    await status.updateStatuses();

    t.is(databaseJobGetByDate.callCount, 3);
    t.true(t.context.databaseStatusAddStub.calledOnce);
    t.true(t.context.databaseStatusUpdateStub.calledOnce);

    const args = t.context.databaseStatusAddStub.args[0][0];

    t.is(args.hints.errors, 2);
    t.is(args.hints.warnings, 1);
    t.is(args.hints.passes, 3);

    const noDisallowedHeaders = args.hints.hints['no-disallowed-headers'];
    const noFriendlyErrorPages = args.hints.hints['no-friendly-error-pages'];

    t.is(noDisallowedHeaders.errors, 2);
    t.is(noDisallowedHeaders.warnings, 1);
    t.is(noDisallowedHeaders.passes, 0);
    t.is(noDisallowedHeaders.urls.length, 3);
    t.is(noDisallowedHeaders.urls[0].errors, 1);
    t.is(noDisallowedHeaders.urls[0].warnings, 1);
    t.is(noFriendlyErrorPages.urls.length, 3);
    t.is(noFriendlyErrorPages.passes, 3);
    t.is(noFriendlyErrorPages.errors, 0);
    t.is(noFriendlyErrorPages.warnings, 0);
});

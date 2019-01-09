import test, { ExecutionContext } from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import { UserConfig } from 'hint/dist/src/lib/types';
import * as moment from 'moment';

const common = {
    validateConnection(): boolean {
        return false;
    }
};

type Query = {
    count: () => Query;
    exec: () => Promise<any>;
    remove: () => Query;
    sort: () => Query;
};

const query: Query = {
    count() {
        return query;
    },
    exec(): Promise<any> {
        return null;
    },
    remove() {
        return query;
    },
    sort() {
        return query;
    }
};

const modelObject = { save() { } };

const Job: any = function () {
    return modelObject;
};

Job.find = () => { };
Job.findOne = () => { };

const jobModels = { Job };

const ntp = {
    getTime() {
        Promise.resolve({ now: new Date() });
    }
};

proxyquire('../../../../src/lib/common/database/methods/job', {
    '../../ntp/ntp': ntp,
    '../models/job': jobModels,
    './common': common
});

import * as job from '../../../../src/lib/common/database/methods/job';
import { IJob } from '../../../../src/lib/types';
import { JobStatus } from '../../../../src/lib/enums/status';

const jobResult: Array<IJob> = [{
    config: null,
    error: null,
    finished: new Date(),
    hints: null,
    maxRunTime: 180,
    queued: new Date(),
    started: new Date(),
    status: JobStatus.pending,
    url: 'url',
    webhintVersion: null
}];
const error = new Error('Database not connected');

type DBJobTestContext = {
    sandbox: sinon.SinonSandbox;
    jobFindStub: sinon.SinonStub;
    jobFindOneStub: sinon.SinonStub;
    queryCountStub: sinon.SinonStub;
    queryRemoveStub: sinon.SinonStub;
    querySortStub: sinon.SinonStub;
};

type TestContext = ExecutionContext<DBJobTestContext>;

test.beforeEach((t: TestContext) => {
    const sandbox = sinon.createSandbox();

    t.context.jobFindStub = sandbox.stub(Job, 'find').returns(query);
    t.context.jobFindOneStub = sandbox.stub(Job, 'findOne').returns(query);
    t.context.queryCountStub = sandbox.stub(query, 'count').returns(query);
    t.context.queryRemoveStub = sandbox.stub(query, 'remove').returns(query);
    t.context.querySortStub = sandbox.stub(query, 'sort').returns(query);

    t.context.sandbox = sandbox;
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

test.serial('job.getByUrl should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await job.getByUrl('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('job.get should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await job.get('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('job.getByDate should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await job.getByDate('started', new Date(), new Date());
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('job.add should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await job.add('url', JobStatus.pending, [], [{}] as Array<UserConfig>, 180);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('job.getStatusCount should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await job.getStatusCount(JobStatus.error);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('job.getCount should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await job.getCount();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('job.getByUrl should return a job', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').returns(true);

    const queryExecStub = sandbox.stub(query, 'exec').resolves(jobResult);

    const result = await job.getByUrl('url');

    t.true(queryExecStub.calledOnce);
    t.true(t.context.jobFindStub.calledOnce);
    t.is(result, jobResult);

    queryExecStub.restore();
});

test.serial('job.get should return a job', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').returns(true);

    const queryExecStub = sandbox.stub(query, 'exec').resolves(jobResult[0]);

    const result = await job.get('url');

    t.true(queryExecStub.calledOnce);
    t.true(t.context.jobFindOneStub.calledOnce);
    t.is(result, jobResult[0]);

    queryExecStub.restore();
});

test.serial('job.add should save a new job in database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').returns(true);

    const modelObjectSaveStub = sandbox.stub(modelObject, 'save').resolves();

    await job.add('url', JobStatus.pending, null, null, 180);

    t.true(modelObjectSaveStub.calledOnce);
});

test.serial('job.getByDate should return the jobs between both dates', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').returns(true);

    const queryExecStub = sandbox.stub(query, 'exec').resolves(jobResult);

    const field = 'started';
    const from = moment();
    const to = moment().add(3, 'hour');

    const result = await job.getByDate(field, from.toDate(), to.toDate());

    t.true(queryExecStub.calledOnce);
    t.true(t.context.jobFindStub.calledOnce);

    const args = t.context.jobFindStub.args[0][0];

    t.true(from.isSame(moment(args[field].$gte)));
    t.true(to.isSame(moment(args[field].$lt)));
    t.is(result, jobResult);

    queryExecStub.restore();
});

test.serial('job.getStatusCount should return the number of jobs with that status', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').returns(true);
    const queryExecStub = sandbox.stub(query, 'exec').resolves();

    await job.getStatusCount(JobStatus.error);

    t.true(t.context.queryCountStub.calledOnce);
    t.true(queryExecStub.calledOnce);
    t.true(t.context.jobFindStub.calledOnce);
    t.is(t.context.jobFindStub.args[0][0].status, JobStatus.error);

    queryExecStub.restore();
});

test.serial('job.getStatusCount with a since parameter should return the number of jobs since that date with that status', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').returns(true);

    const queryExecStub = sandbox.stub(query, 'exec').resolves();

    const since = new Date();

    await job.getStatusCount(JobStatus.error, {
        field: 'finished',
        since
    });

    t.true(t.context.queryCountStub.calledOnce);
    t.true(queryExecStub.calledOnce);
    t.true(t.context.jobFindStub.calledOnce);
    t.is(t.context.jobFindStub.args[0][0].status, JobStatus.error);
    t.is(t.context.jobFindStub.args[0][0].finished.$gte, since);

    queryExecStub.restore();
});

test.serial('job.getCount should return the number of jobs in the database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').returns(true);
    const queryExecStub = sandbox.stub(query, 'exec').resolves();

    await job.getCount();

    t.true(t.context.queryCountStub.calledOnce);
    t.true(queryExecStub.calledOnce);
    t.true(t.context.jobFindStub.calledOnce);
    t.deepEqual(t.context.jobFindStub.args[0][0], {});

    queryExecStub.restore();
});

test.serial('job.getCount with a since parameter should return the number of jobs since that date', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').returns(true);
    const queryExecStub = sandbox.stub(query, 'exec').resolves();

    const since = new Date();

    await job.getCount({ since });

    t.true(t.context.queryCountStub.calledOnce);
    t.true(queryExecStub.calledOnce);
    t.true(t.context.jobFindStub.calledOnce);
    t.is(t.context.jobFindStub.args[0][0].finished.$gte, since);

    queryExecStub.restore();
});

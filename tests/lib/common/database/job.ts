import test from 'ava';
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
    exec: () => Query;
    remove: () => Query;
    sort: () => Query;
};

const query: Query = {
    count() {
        return query;
    },
    exec() {
        return query;
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

test.beforeEach((t) => {
    sinon.stub(Job, 'find').returns(query);
    sinon.stub(Job, 'findOne').returns(query);
    sinon.stub(query, 'remove').returns(query);
    sinon.stub(query, 'count').returns(query);
    sinon.stub(query, 'sort').returns(query);

    t.context.Job = Job;
    t.context.query = query;
    t.context.common = common;
});

test.afterEach.always((t) => {
    t.context.query.remove.restore();
    t.context.query.count.restore();
    t.context.query.sort.restore();
    t.context.Job.find.restore();
    t.context.Job.findOne.restore();

    if (t.context.common.validateConnection.restore) {
        t.context.common.validateConnection.restore();
    }
});

test.serial('job.getByUrl should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await job.getByUrl('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('job.get should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await job.get('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('job.getByDate should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await job.getByDate('started', new Date(), new Date());
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('job.add should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await job.add('url', JobStatus.pending, [], [{}] as Array<UserConfig>, 180);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('job.getStatusCount should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await job.getStatusCount(JobStatus.error);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('job.getCount should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await job.getCount();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('job.getByUrl should return a job', async (t) => {
    sinon.stub(common, 'validateConnection').returns(true);

    sinon.stub(query, 'exec').resolves(jobResult);

    const result = await job.getByUrl('url');

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.find.calledOnce);
    t.is(result, jobResult);

    t.context.query.exec.restore();
});

test.serial('job.get should return a job', async (t) => {
    sinon.stub(common, 'validateConnection').returns(true);

    sinon.stub(query, 'exec').resolves(jobResult[0]);

    const result = await job.get('url');

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.findOne.calledOnce);
    t.is(result, jobResult[0]);

    t.context.query.exec.restore();
});

test.serial('job.add should save a new job in database', async (t) => {
    sinon.stub(common, 'validateConnection').returns(true);

    sinon.stub(modelObject, 'save').resolves();

    t.context.modelObject = modelObject;

    await job.add('url', JobStatus.pending, null, null, 180);

    t.true(t.context.modelObject.save.calledOnce);

    t.context.modelObject.save.restore();
});

test.serial('job.getByDate should return the jobs between both dates', async (t) => {
    sinon.stub(common, 'validateConnection').returns(true);

    sinon.stub(query, 'exec').resolves(jobResult);

    const field = 'started';
    const from = moment();
    const to = moment().add(3, 'hour');

    const result = await job.getByDate(field, from.toDate(), to.toDate());

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.find.calledOnce);

    const args = t.context.Job.find.args[0][0];

    t.true(from.isSame(moment(args[field].$gte)));
    t.true(to.isSame(moment(args[field].$lt)));
    t.is(result, jobResult);

    t.context.query.exec.restore();
});

test.serial('job.getStatusCount should return the number of jobs with that status', async (t) => {
    sinon.stub(common, 'validateConnection').returns(true);
    sinon.stub(query, 'exec').resolves();

    await job.getStatusCount(JobStatus.error);

    t.true(t.context.query.count.calledOnce);
    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.find.calledOnce);
    t.is(t.context.Job.find.args[0][0].status, JobStatus.error);

    t.context.query.exec.restore();
});

test.serial('job.getStatusCount with a since parameter should return the number of jobs since that date with that status', async (t) => {
    sinon.stub(common, 'validateConnection').returns(true);

    sinon.stub(query, 'exec').resolves();

    const since = new Date();

    await job.getStatusCount(JobStatus.error, {
        field: 'finished',
        since
    });

    t.true(t.context.query.count.calledOnce);
    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.find.calledOnce);
    t.is(t.context.Job.find.args[0][0].status, JobStatus.error);
    t.is(t.context.Job.find.args[0][0].finished.$gte, since);

    t.context.query.exec.restore();
});

test.serial('job.getCount should return the number of jobs in the database', async (t) => {
    sinon.stub(common, 'validateConnection').returns(true);
    sinon.stub(query, 'exec').resolves();

    await job.getCount();

    t.true(t.context.query.count.calledOnce);
    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.find.calledOnce);
    t.deepEqual(t.context.Job.find.args[0][0], {});

    t.context.query.exec.restore();
});

test.serial('job.getCount with a since parameter should return the number of jobs since that date', async (t) => {
    sinon.stub(common, 'validateConnection').returns(true);
    sinon.stub(query, 'exec').resolves();

    const since = new Date();

    await job.getCount({ since });

    t.true(t.context.query.count.calledOnce);
    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.find.calledOnce);
    t.is(t.context.Job.find.args[0][0].finished.$gte, since);

    t.context.query.exec.restore();
});

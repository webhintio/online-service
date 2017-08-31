import * as path from 'path';

import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as moment from 'moment';

const database = {
    getJob() { },
    getJobsByUrl() { },
    lock() { },
    newJob() { },
    unlock() { }
};

const configManager = { getActiveConfiguration() { } };

const queueMethods = { sendMessage() { } };

const Queue = function () {
    return queueMethods;
};

const queueObject = { Queue };

proxyquire('../../../../src/lib/microservices/job-manager/job-manager', {
    '../../common/database/database': database,
    '../../common/queue/queue': queueObject,
    '../config-manager/config-manager': configManager
});

import * as jobManager from '../../../../src/lib/microservices/job-manager/job-manager';
import { ConfigSource } from '../../../../src/lib/enums/configsource';
import { JobStatus, RuleStatus } from '../../../../src/lib/enums/status';
import { readFileAsync } from '../../../../src/lib/utils/misc';
import { IJob } from '../../../../src/lib/types/job'; // eslint-disable-line no-unused-vars

const activeConfig = {
    jobCacheTime: 120,
    sonarConfig: { rules: ['rule1', 'rule2'] }
};

test.beforeEach(async (t) => {
    sinon.stub(database, 'getJob').resolves({});
    sinon.stub(database, 'lock').resolves({});
    sinon.stub(database, 'unlock').resolves({});
    sinon.stub(database, 'newJob').resolves({});
    sinon.stub(configManager, 'getActiveConfiguration').resolves(activeConfig);
    sinon.spy(queueMethods, 'sendMessage');

    t.context.jobs = JSON.parse(await readFileAsync(path.join(__dirname, 'fixtures', 'jobs.json')));
    t.context.database = database;
    t.context.queueMethods = queueMethods;
    t.context.configManager = configManager;
});

test.afterEach.always((t) => {
    t.context.database.getJob.restore();
    t.context.database.lock.restore();
    t.context.database.unlock.restore();
    t.context.database.newJob.restore();
    t.context.queueMethods.sendMessage.restore();
    t.context.configManager.getActiveConfiguration.restore();
});

test.serial(`if the job doesn't exist, it should create a new job and add it to the queue`, async (t) => {
    sinon.stub(database, 'getJobsByUrl').resolves([]);
    const jobInput = {
        config: null,
        rules: ['rule1', 'rule2'],
        source: ConfigSource.manual,
        url: 'http://sonarwhal.com'
    };

    await jobManager.startJob(jobInput);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.newJob.calledOnce);
    t.true(t.context.queueMethods.sendMessage.calledOnce);

    const args = t.context.database.newJob.args[0];

    t.is(args[0], jobInput.url);
    t.is(args[1], JobStatus.pending);
    t.deepEqual(args[2], [{
        messages: [],
        name: 'rule1',
        status: RuleStatus.pending
    }, {
        messages: [],
        name: 'rule2',
        status: RuleStatus.pending
    }]);
    t.deepEqual(args[3], {
        rules: {
            rule1: RuleStatus.error,
            rule2: RuleStatus.error
        }
    });

    t.context.database.getJobsByUrl.restore();
});

test.serial(`if the job doesn't exist, it should use the defaul configuration if source is not set`, async (t) => {
    sinon.stub(database, 'getJobsByUrl').resolves([]);
    const jobInput = {
        config: null,
        rules: null,
        source: null,
        url: 'http://sonarwhal.com'
    };

    await jobManager.startJob(jobInput);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.newJob.calledOnce);
    t.true(t.context.queueMethods.sendMessage.calledOnce);

    const args = t.context.database.newJob.args[0];

    t.is(args[0], jobInput.url);
    t.is(args[1], JobStatus.pending);
    t.deepEqual(args[2], [{
        messages: [],
        name: 'rule1',
        status: RuleStatus.pending
    }, {
        messages: [],
        name: 'rule2',
        status: RuleStatus.pending
    }]);
    t.deepEqual(args[3], {
        rules: {
            rule1: RuleStatus.error,
            rule2: RuleStatus.error
        }
    });

    t.context.database.getJobsByUrl.restore();
});

const setExpired = (job: IJob) => {
    job.finished = moment().subtract(3, 'minutes')
        .toDate();
};

const setNoExpired = (job: IJob) => {
    job.finished = new Date();
};

test.serial(`if the job exists, but it is expired, it should create a new job and add it to the queue`, async (t) => {
    const jobs = t.context.jobs;

    setExpired(jobs[0]);

    sinon.stub(database, 'getJobsByUrl').resolves(jobs);
    const jobInput = {
        config: null,
        rules: ['rule1', 'rule2'],
        source: ConfigSource.manual,
        url: 'http://sonarwhal.com'
    };

    await jobManager.startJob(jobInput);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.newJob.calledOnce);
    t.true(t.context.queueMethods.sendMessage.calledOnce);

    const args = t.context.database.newJob.args[0];

    t.is(args[0], jobInput.url);
    t.is(args[1], JobStatus.pending);
    t.deepEqual(args[2], [{
        messages: [],
        name: 'rule1',
        status: RuleStatus.pending
    }, {
        messages: [],
        name: 'rule2',
        status: RuleStatus.pending
    }]);
    t.deepEqual(args[3], {
        rules: {
            rule1: RuleStatus.error,
            rule2: RuleStatus.error
        }
    });

    t.context.database.getJobsByUrl.restore();
});

test.serial(`if the job exists, but config is different, it should create a new job and add it to the queue`, async (t) => {
    const jobs = t.context.jobs;

    jobs[0].config = {
        rules: {
            rule1: RuleStatus.error,
            rule3: RuleStatus.error
        }
    };

    sinon.stub(database, 'getJobsByUrl').resolves(jobs);
    const jobInput = {
        config: null,
        rules: ['rule1', 'rule2'],
        source: ConfigSource.manual,
        url: 'http://sonarwhal.com'
    };

    await jobManager.startJob(jobInput);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.newJob.calledOnce);
    t.true(t.context.queueMethods.sendMessage.calledOnce);

    const args = t.context.database.newJob.args[0];

    t.is(args[0], jobInput.url);
    t.is(args[1], JobStatus.pending);
    t.deepEqual(args[2], [{
        messages: [],
        name: 'rule1',
        status: RuleStatus.pending
    }, {
        messages: [],
        name: 'rule2',
        status: RuleStatus.pending
    }]);
    t.deepEqual(args[3], {
        rules: {
            rule1: RuleStatus.error,
            rule2: RuleStatus.error
        }
    });

    t.context.database.getJobsByUrl.restore();
});

test.serial(`if the job exists and it isn't expired, it shouldn't create a new job`, async (t) => {
    const jobs = t.context.jobs;

    setNoExpired(jobs[0]);

    sinon.stub(database, 'getJobsByUrl').resolves(jobs);
    const jobInput = {
        config: null,
        rules: ['rule1', 'rule2'],
        source: ConfigSource.manual,
        url: 'http://sonarwhal.com'
    };

    const result = await jobManager.startJob(jobInput);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.false(t.context.database.newJob.called);
    t.false(t.context.queueMethods.sendMessage.called);
    t.is(result, jobs[0]);

    t.context.database.getJobsByUrl.restore();
});

test.serial(`if the job is still running, it shouldn't create a new job`, async (t) => {
    const jobs = t.context.jobs;

    sinon.stub(database, 'getJobsByUrl').resolves(jobs);
    const jobInput = {
        config: null,
        rules: ['rule1', 'rule2'],
        source: ConfigSource.manual,
        url: 'http://sonarwhal.com'
    };

    const result = await jobManager.startJob(jobInput);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.false(t.context.database.newJob.called);
    t.false(t.context.queueMethods.sendMessage.called);
    t.is(result, jobs[0]);

    t.context.database.getJobsByUrl.restore();
});

test.serial('jobManager.getJob should call to the database to get the job', async (t) => {
    await jobManager.getJob('jobId');

    t.true(t.context.database.getJob.calledOnce);
});

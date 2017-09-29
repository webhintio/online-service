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
    unlock() { },
    updateJob() { }
};

const configManager = { getActiveConfiguration() { } };

const queueMethods = {
    getMessagesCount() { },
    sendMessage() { }
};

const Queue = function () {
    return queueMethods;
};

const queueObject = { Queue };

const rule = { meta: { docs: { category: 'category' } } };

const resourceLoader = { loadRule() { } };

proxyquire('../../../../src/lib/microservices/job-manager/job-manager', {
    '../../common/database/database': database,
    '../../common/queue/queue': queueObject,
    '../config-manager/config-manager': configManager,
    '@sonarwhal/sonar/dist/src/lib/utils/resource-loader': resourceLoader
});

import * as jobManager from '../../../../src/lib/microservices/job-manager/job-manager';
import { ConfigSource } from '../../../../src/lib/enums/configsource';
import { JobStatus, RuleStatus } from '../../../../src/lib/enums/status';
import { readFileAsync } from '../../../../src/lib/utils/misc';
import { IJob } from '../../../../src/lib/types';

const activeConfig = {
    jobCacheTime: 120,
    sonarConfigs: [{
        rules: {
            rule1: 'error',
            rule2: 'error'
        }
    },
    {
        rules: {
            rule3: 'error',
            rule4: 'error'
        }
    }]
};

const validatedJobCreatedInDatabase = (t, jobInput) => {
    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.newJob.calledOnce);
    t.true(t.context.queueMethods.sendMessage.calledTwice);

    const args = t.context.database.newJob.args[0];

    t.is(args[0], jobInput.url);
    t.is(args[1], JobStatus.pending);
    t.deepEqual(args[2], [{
        category: 'category',
        messages: [],
        name: 'rule1',
        status: RuleStatus.pending
    }, {
        category: 'category',
        messages: [],
        name: 'rule2',
        status: RuleStatus.pending
    }, {
        category: 'category',
        messages: [],
        name: 'rule3',
        status: RuleStatus.pending
    }, {
        category: 'category',
        messages: [],
        name: 'rule4',
        status: RuleStatus.pending
    }]);
    t.deepEqual(args[3], [{
        rules: {
            rule1: 'error',
            rule2: 'error'
        }
    },
    {
        rules: {
            rule3: 'error',
            rule4: 'error'
        }
    }]);
};

test.beforeEach(async (t) => {
    sinon.stub(database, 'getJob').resolves({});
    sinon.stub(database, 'lock').resolves({});
    sinon.stub(database, 'unlock').resolves({});
    sinon.spy(database, 'updateJob');
    sinon.stub(configManager, 'getActiveConfiguration').resolves(activeConfig);
    sinon.spy(queueMethods, 'getMessagesCount');
    sinon.stub(resourceLoader, 'loadRule').returns(rule);

    t.context.jobs = JSON.parse(await readFileAsync(path.join(__dirname, 'fixtures', 'jobs.json')));
    t.context.database = database;
    t.context.queueMethods = queueMethods;
    t.context.configManager = configManager;
    t.context.resourceLoader = resourceLoader;
});

test.afterEach.always((t) => {
    t.context.database.getJob.restore();
    t.context.database.lock.restore();
    t.context.database.unlock.restore();
    t.context.database.updateJob.restore();
    if (t.context.database.newJob.restore) {
        t.context.database.newJob.restore();
    }
    if (t.context.queueMethods.sendMessage.restore) {
        t.context.queueMethods.sendMessage.restore();
    }
    if (t.context.database.getJobsByUrl.restore) {
        t.context.database.getJobsByUrl.restore();
    }
    t.context.queueMethods.getMessagesCount.restore();
    t.context.configManager.getActiveConfiguration.restore();
    t.context.resourceLoader.loadRule.restore();
});

test.serial(`if the job doesn't exist, it should create a new job and add it to the queue`, async (t) => {
    sinon.spy(queueMethods, 'sendMessage');
    sinon.stub(database, 'getJobsByUrl').resolves([]);
    const jobInput = {
        config: activeConfig.sonarConfigs,
        rules: [],
        source: ConfigSource.default,
        url: 'http://sonarwhal.com'
    };

    sinon.stub(database, 'newJob').resolves(jobInput);

    await jobManager.startJob(jobInput);

    validatedJobCreatedInDatabase(t, jobInput);
});

test.serial(`if the job doesn't exist, but there is an error in Service Bus, it should set the status or the job to error`, async (t) => {
    sinon.stub(queueMethods, 'sendMessage').rejects();
    sinon.stub(database, 'getJobsByUrl').resolves([]);
    const jobInput = {
        config: activeConfig.sonarConfigs,
        rules: [],
        source: ConfigSource.default,
        url: 'http://sonarwhal.com'
    };

    sinon.stub(database, 'newJob').resolves(jobInput);

    await jobManager.startJob(jobInput);

    t.true(t.context.database.updateJob.calledOnce);
});

test.serial(`if the job doesn't exist, it should use the defaul configuration if source is not set`, async (t) => {
    sinon.spy(queueMethods, 'sendMessage');
    sinon.stub(database, 'getJobsByUrl').resolves([]);
    const jobInput = {
        config: activeConfig.sonarConfigs,
        rules: null,
        source: null,
        url: 'http://sonarwhal.com'
    };

    sinon.stub(database, 'newJob').resolves(jobInput);

    await jobManager.startJob(jobInput);

    validatedJobCreatedInDatabase(t, jobInput);
});

const setExpired = (job: IJob) => {
    job.finished = moment().subtract(3, 'minutes')
        .toDate();
    job.status = JobStatus.finished;
};

const setNoExpired = (job: IJob) => {
    job.finished = new Date();
    job.status = JobStatus.finished;
};

test.serial(`if the job exists, but it is expired, it should create a new job and add it to the queue`, async (t) => {
    const jobs = t.context.jobs;

    setExpired(jobs[0]);

    sinon.spy(queueMethods, 'sendMessage');
    sinon.stub(database, 'getJobsByUrl').resolves(jobs);
    const jobInput = {
        config: activeConfig.sonarConfigs,
        rules: [],
        source: ConfigSource.default,
        url: 'http://sonarwhal.com'
    };

    sinon.stub(database, 'newJob').resolves(jobInput);

    await jobManager.startJob(jobInput);

    validatedJobCreatedInDatabase(t, jobInput);
});

test.serial(`if the job exists, but config is different, it should create a new job and add it to the queue`, async (t) => {
    const jobs = t.context.jobs;

    jobs[0].config = [{
        rules: {
            rule1: RuleStatus.error,
            rule3: RuleStatus.error
        }
    }];

    sinon.spy(queueMethods, 'sendMessage');
    sinon.stub(database, 'getJobsByUrl').resolves(jobs);
    const jobInput = {
        config: activeConfig.sonarConfigs,
        rules: [],
        source: ConfigSource.default,
        url: 'http://sonarwhal.com'
    };

    sinon.stub(database, 'newJob').resolves(jobInput);

    await jobManager.startJob(jobInput);

    validatedJobCreatedInDatabase(t, jobInput);
});

test.serial(`if the source is a file and the config is not valid, it should return an error`, async (t) => {
    sinon.spy(queueMethods, 'sendMessage');
    sinon.stub(database, 'getJobsByUrl').resolves([]);
    const jobInput = {
        config: JSON.parse(await readFileAsync(path.join(__dirname, '../fixtures/config-invalid.json'))),
        rules: null,
        source: ConfigSource.file,
        url: 'http://sonarwhal.com'
    };

    sinon.spy(database, 'newJob');
    t.plan(2);
    try {
        await jobManager.startJob(jobInput);
    } catch (err) {
        t.false(t.context.database.newJob.called);
        t.true(err.message.startsWith('Invalid Configuration'));
    }
});

test.serial(`if the source is a file and the config has duplicated rules, it should return an error`, async (t) => {
    sinon.spy(queueMethods, 'sendMessage');
    sinon.stub(database, 'getJobsByUrl').resolves([]);
    const jobInput = {
        config: JSON.parse(await readFileAsync(path.join(__dirname, '../fixtures/config-duplicates.json'))),
        rules: null,
        source: ConfigSource.file,
        url: 'http://sonarwhal.com'
    };

    sinon.spy(database, 'newJob');
    t.plan(2);
    try {
        await jobManager.startJob(jobInput);
    } catch (err) {
        t.false(t.context.database.newJob.called);
        t.is(err.message, 'Rule manifest-is-valid repeated');
    }
});

test.serial(`if the source is a file and the config is valid, it should create a new job`, async (t) => {
    sinon.spy(queueMethods, 'sendMessage');
    sinon.stub(database, 'getJobsByUrl').resolves([]);
    const jobInput = {
        config: JSON.parse(await readFileAsync(path.join(__dirname, '../fixtures/config.json'))),
        rules: null,
        source: ConfigSource.file,
        url: 'http://sonarwhal.com'
    };

    sinon.stub(database, 'newJob').resolves(jobInput);

    await jobManager.startJob(jobInput);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.newJob.calledOnce);
    t.is(t.context.queueMethods.sendMessage.callCount, 7);

    const args = t.context.database.newJob.args[0];

    t.is(args[0], jobInput.url);
    t.is(args[1], JobStatus.pending);
    t.deepEqual(args[2].length, 21);
    t.deepEqual(args[3].length, 7);
});

test.serial(`if the job exists and it isn't expired, it shouldn't create a new job`, async (t) => {
    const jobs = t.context.jobs;

    setNoExpired(jobs[0]);

    sinon.spy(queueMethods, 'sendMessage');
    sinon.stub(database, 'getJobsByUrl').resolves(jobs);
    const jobInput = {
        config: null,
        rules: [],
        source: ConfigSource.default,
        url: 'http://sonarwhal.com'
    };

    sinon.spy(database, 'newJob');

    const result = await jobManager.startJob(jobInput);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.false(t.context.database.newJob.called);
    t.false(t.context.queueMethods.sendMessage.called);
    t.is(result, jobs[0]);
});

test.serial(`if the job exists, the status is neither finish or error, but finished is set, it shouldn't create a new job`, async (t) => {
    const jobs = t.context.jobs;

    jobs[0].finished = new Date();

    sinon.spy(queueMethods, 'sendMessage');
    sinon.stub(database, 'getJobsByUrl').resolves(jobs);
    const jobInput = {
        config: null,
        rules: [],
        source: ConfigSource.default,
        url: 'http://sonarwhal.com'
    };

    sinon.spy(database, 'newJob');

    const result = await jobManager.startJob(jobInput);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.false(t.context.database.newJob.called);
    t.false(t.context.queueMethods.sendMessage.called);
    t.is(result, jobs[0]);
});

test.serial(`if the job is still running, it shouldn't create a new job`, async (t) => {
    const jobs = t.context.jobs;

    sinon.spy(queueMethods, 'sendMessage');
    sinon.stub(database, 'getJobsByUrl').resolves(jobs);
    const jobInput = {
        config: null,
        rules: [],
        source: ConfigSource.default,
        url: 'http://sonarwhal.com'
    };

    sinon.spy(database, 'newJob');

    const result = await jobManager.startJob(jobInput);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.false(t.context.database.newJob.called);
    t.false(t.context.queueMethods.sendMessage.called);
    t.is(result, jobs[0]);


});

test.serial('jobManager.getJob should call to the database to get the job', async (t) => {
    await jobManager.getJob('jobId');

    t.true(t.context.database.getJob.calledOnce);
});

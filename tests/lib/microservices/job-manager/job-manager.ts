import * as path from 'path';

import test, { ExecutionContext } from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as moment from 'moment';

const database = {
    job: {
        add(): Promise<any> {
            return null;
        },
        get(): Promise<any> {
            return null;
        },
        getByUrl(): Promise<IJob[]> {
            return null;
        },
        update() { }
    },
    lock(): Promise<any> {
        return null;
    },
    unlock(): Promise<any> {
        return null;
    }
};

const configManager = {
    active(): Promise<IServiceConfig> {
        return null;
    }
};

const queueMethods = {
    getMessagesCount() { },
    sendMessage() { }
};

const Queue = function () {
    return queueMethods;
};

const queueObject = { Queue };

type Hint = {
    meta: any;
};

const hint: Hint = { meta: { docs: { category: 'category' } } };

const resourceLoader = {
    loadHint(): Hint {
        return hint;
    }
};

const ntp = {
    getTime() {
        Promise.resolve({ now: new Date() });
    }
};

process.env.queue = 'connectionString'; // eslint-disable-line no-process-env

proxyquire('../../../../src/lib/microservices/job-manager/job-manager', {
    '../../common/database/database': database,
    '../../common/ntp/ntp': ntp,
    '../../common/queue/queue': queueObject,
    '../config-manager/config-manager': configManager,
    'hint/dist/src/lib/utils/resource-loader': resourceLoader
});

import * as jobManager from '../../../../src/lib/microservices/job-manager/job-manager';
import { ConfigSource } from '../../../../src/lib/enums/configsource';
import { JobStatus, HintStatus } from '../../../../src/lib/enums/status';
import { readFileAsync } from '../../../../src/lib/utils/misc';
import { IJob, IServiceConfig } from '../../../../src/lib/types';

const activeConfig: IServiceConfig = {
    active: true,
    jobCacheTime: 120,
    jobRunTime: 100,
    name: 'test',
    webhintConfigs: [{
        hints: {
            hint1: 'error',
            hint2: 'error'
        }
    },
    {
        hints: {
            hint3: 'error',
            hint4: 'error'
        }
    }]
};

const validatedJobCreatedInDatabase = (t: TestContext, jobInput) => {
    t.true(t.context.databaseLockStub.calledOnce);
    t.true(t.context.databaseUnlockStub.calledOnce);
    t.true(t.context.databaseJobAddStub.calledOnce);
    t.true(t.context.queueMethodsSendMessageStub.calledTwice);

    const args = t.context.databaseJobAddStub.args[0];

    t.is(args[0], jobInput.url);
    t.is(args[1], JobStatus.pending);
    t.deepEqual(args[2], [{
        category: 'category',
        messages: [],
        name: 'hint1',
        status: HintStatus.pending
    }, {
        category: 'category',
        messages: [],
        name: 'hint2',
        status: HintStatus.pending
    }, {
        category: 'category',
        messages: [],
        name: 'hint3',
        status: HintStatus.pending
    }, {
        category: 'category',
        messages: [],
        name: 'hint4',
        status: HintStatus.pending
    }]);
    t.deepEqual(args[3], [{
        hints: {
            hint1: 'error',
            hint2: 'error'
        }
    },
    {
        hints: {
            hint3: 'error',
            hint4: 'error'
        }
    }]);
};

type JobTestContext = {
    sandbox: sinon.SinonSandbox;
    jobs: any;
    configManagerActiveStub: sinon.SinonStub;
    databaseLockStub: sinon.SinonStub;
    databaseUnlockStub: sinon.SinonStub;
    databaseJobAddStub: sinon.SinonStub | sinon.SinonSpy;
    databaseJobGetByUrlStub: sinon.SinonStub;
    databaseJobGetStub: sinon.SinonStub;
    databaseJobUpdateSpy: sinon.SinonSpy;
    queueMethodsGetMessagesCountSpy: sinon.SinonSpy;
    queueMethodsSendMessageStub: sinon.SinonStub | sinon.SinonSpy;
    resourceLoaderLoadHintStub: sinon.SinonStub;
};

type TestContext = ExecutionContext<JobTestContext>;

test.beforeEach(async (t: TestContext) => {
    const sandbox = sinon.createSandbox();

    t.context.databaseJobGetStub = sandbox.stub(database.job, 'get').resolves({});
    t.context.databaseLockStub = sandbox.stub(database, 'lock').resolves({});
    t.context.databaseUnlockStub = sandbox.stub(database, 'unlock').resolves({});
    t.context.databaseJobUpdateSpy = sandbox.spy(database.job, 'update');
    t.context.configManagerActiveStub = sandbox.stub(configManager, 'active').resolves(activeConfig);
    t.context.queueMethodsGetMessagesCountSpy = sandbox.spy(queueMethods, 'getMessagesCount');
    t.context.resourceLoaderLoadHintStub = sandbox.stub(resourceLoader, 'loadHint').returns(hint);

    t.context.jobs = JSON.parse(await readFileAsync(path.join(__dirname, 'fixtures', 'jobs.json')));

    t.context.sandbox = sandbox;
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

test.serial(`if there is no url, it should return an error`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const jobInput = {
        fields: {
            config: activeConfig.webhintConfigs,
            hints: [],
            source: ConfigSource.default,
            url: null
        },
        files: {}
    };

    t.context.databaseJobAddStub = sandbox.stub(database.job, 'add').resolves(jobInput);

    try {
        await jobManager.startJob(jobInput);
    } catch (err) {
        t.is(err.message, 'Url is required');
    }
});

test.serial(`if the job doesn't exist, it should create a new job and add it to the queue`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    t.context.queueMethodsSendMessageStub = sandbox.spy(queueMethods, 'sendMessage');
    t.context.databaseJobGetByUrlStub = sandbox.stub(database.job, 'getByUrl').resolves([]);
    const jobInput = {
        fields: {
            config: null,
            hints: [],
            source: [ConfigSource.default],
            url: ['http://webhint.io']
        },
        files: {}
    };

    const jobResult = {
        config: activeConfig.webhintConfigs,
        hints: [],
        url: 'http://webhint.io'
    };

    t.context.databaseJobAddStub = sandbox.stub(database.job, 'add').resolves(jobResult);

    await jobManager.startJob(jobInput);

    validatedJobCreatedInDatabase(t, jobResult);
});

test.serial(`if the job doesn't exist, but there is an error in Service Bus, it should set the status or the job to error`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    t.context.queueMethodsSendMessageStub = sandbox.stub(queueMethods, 'sendMessage').rejects();
    t.context.databaseJobGetByUrlStub = sandbox.stub(database.job, 'getByUrl').resolves([]);
    const jobInput = {
        fields: {
            config: null,
            hints: [],
            source: [ConfigSource.default],
            url: ['http://webhint.io']
        },
        files: {}
    };

    const jobResult = {
        config: activeConfig.webhintConfigs,
        hints: [],
        url: 'http://webhint.io'
    };

    t.context.databaseJobAddStub = sandbox.stub(database.job, 'add').resolves(jobResult);

    await jobManager.startJob(jobInput);

    t.true(t.context.databaseJobUpdateSpy.calledOnce);
});

test.serial(`if the job doesn't exist, it should use the defaul configuration if source is not set`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    t.context.queueMethodsSendMessageStub = sandbox.spy(queueMethods, 'sendMessage');
    t.context.databaseJobGetByUrlStub = sandbox.stub(database.job, 'getByUrl').resolves([]);
    const jobInput = {
        fields: {
            config: null,
            hints: [],
            source: null,
            url: ['http://webhint.io']
        },
        files: {}
    };

    const jobResult = {
        config: activeConfig.webhintConfigs,
        hints: [],
        url: 'http://webhint.io'
    };

    t.context.databaseJobAddStub = sandbox.stub(database.job, 'add').resolves(jobResult);

    await jobManager.startJob(jobInput);

    validatedJobCreatedInDatabase(t, jobResult);
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

test.serial(`if the job exists, but it is expired, it should create a new job and add it to the queue`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const jobs = t.context.jobs;

    setExpired(jobs[0]);

    t.context.queueMethodsSendMessageStub = sandbox.spy(queueMethods, 'sendMessage');
    t.context.databaseJobGetByUrlStub = sandbox.stub(database.job, 'getByUrl').resolves(jobs);
    const jobInput = {
        fields: {
            config: null,
            hints: [],
            source: null,
            url: ['http://webhint.io']
        },
        files: {}
    };

    const jobResult = {
        config: activeConfig.webhintConfigs,
        hints: [],
        url: 'http://webhint.io'
    };

    t.context.databaseJobAddStub = sandbox.stub(database.job, 'add').resolves(jobResult);

    await jobManager.startJob(jobInput);

    validatedJobCreatedInDatabase(t, jobResult);
});

test.serial(`if the job exists, but config is different, it should create a new job and add it to the queue`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const jobs = t.context.jobs;

    jobs[0].config = [{
        hints: {
            hint1: HintStatus.error,
            hint3: HintStatus.error
        }
    }];

    t.context.queueMethodsSendMessageStub = sandbox.spy(queueMethods, 'sendMessage');
    t.context.databaseJobGetByUrlStub = sandbox.stub(database.job, 'getByUrl').resolves(jobs);
    const jobInput = {
        fields: {
            config: null,
            hints: [],
            source: ConfigSource.default,
            url: ['http://webhint.io']
        },
        files: {}
    };

    const jobResult = {
        config: activeConfig.webhintConfigs,
        hints: [],
        url: 'http://webhint.io'
    };

    t.context.databaseJobAddStub = sandbox.stub(database.job, 'add').resolves(jobResult);

    await jobManager.startJob(jobInput);

    validatedJobCreatedInDatabase(t, jobResult);
});

test.serial(`if the source is a file and the config is not valid, it should return an error`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    t.context.queueMethodsSendMessageStub = sandbox.spy(queueMethods, 'sendMessage');
    t.context.databaseJobGetByUrlStub = sandbox.stub(database.job, 'getByUrl').resolves([]);
    const jobInput = {
        fields: {
            hints: null,
            source: [ConfigSource.file],
            url: ['http://webhint.io']
        },
        files: {
            'config-file': [{
                path: path.join(__dirname, '../fixtures/config-invalid.json'),
                size: (await readFileAsync(path.join(__dirname, '../fixtures/config-invalid.json'))).length
            }]
        }
    };

    t.context.databaseJobAddStub = sandbox.spy(database.job, 'add');
    t.plan(2);
    try {
        await jobManager.startJob(jobInput);
    } catch (err) {
        t.false(t.context.databaseJobAddStub.called);
        t.true(err.message.startsWith('Invalid Configuration'));
    }
});

test.serial(`if the source is a file and the config has duplicated hints, it should return an error`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    t.context.queueMethodsSendMessageStub = sandbox.spy(queueMethods, 'sendMessage');
    t.context.databaseJobGetByUrlStub = sandbox.stub(database.job, 'getByUrl').resolves([]);
    const jobInput = {
        fields: {
            hints: null,
            source: [ConfigSource.file],
            url: ['http://webhint.io']
        },
        files: {
            'config-file': [{
                path: path.join(__dirname, '../fixtures/config-duplicates.json'),
                size: (await readFileAsync(path.join(__dirname, '../fixtures/config-duplicates.json'))).length
            }]
        }
    };

    t.context.databaseJobAddStub = sandbox.spy(database.job, 'add');
    t.plan(2);
    try {
        await jobManager.startJob(jobInput);
    } catch (err) {
        t.false(t.context.databaseJobAddStub.called);
        t.is(err.message, 'Hint manifest-is-valid repeated');
    }
});

test.serial(`if the source is a file and the config is valid, it should create a new job`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    t.context.queueMethodsSendMessageStub = sandbox.spy(queueMethods, 'sendMessage');
    t.context.databaseJobGetByUrlStub = sandbox.stub(database.job, 'getByUrl').resolves([]);
    const jobInput = {
        fields: {
            hints: null,
            source: [ConfigSource.file],
            url: ['http://webhint.io']
        },
        files: {
            'config-file': [{
                path: path.join(__dirname, '../fixtures/config.json'),
                size: (await readFileAsync(path.join(__dirname, '../fixtures/config.json'))).length
            }]
        }
    };

    const jobResult = {
        config: JSON.parse(await readFileAsync(path.join(__dirname, '../fixtures/config.json'))),
        hints: null,
        source: ConfigSource.file,
        url: 'http://webhint.io'
    };

    t.context.databaseJobAddStub = sandbox.stub(database.job, 'add').resolves(jobResult);

    await jobManager.startJob(jobInput);

    t.true(t.context.databaseLockStub.calledOnce);
    t.true(t.context.databaseUnlockStub.calledOnce);
    t.true(t.context.databaseJobAddStub.calledOnce);
    t.is(t.context.queueMethodsSendMessageStub.callCount, 7);

    const args = t.context.databaseJobAddStub.args[0];

    t.is(args[0], jobResult.url);
    t.is(args[1], JobStatus.pending);
    t.deepEqual(args[2].length, 20);
    t.deepEqual(args[3].length, 7);
});

test.serial(`if the job exists and it isn't expired, it shouldn't create a new job`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const jobs = t.context.jobs;

    setNoExpired(jobs[0]);

    t.context.queueMethodsSendMessageStub = sandbox.spy(queueMethods, 'sendMessage');
    t.context.databaseJobGetByUrlStub = sandbox.stub(database.job, 'getByUrl').resolves(jobs);
    const jobInput = {
        fields: {
            config: null,
            hints: [],
            source: ConfigSource.default,
            url: 'http://webhint.io'
        },
        files: {}
    };

    t.context.databaseJobAddStub = sandbox.spy(database.job, 'add');

    const result = await jobManager.startJob(jobInput);

    t.true(t.context.databaseLockStub.calledOnce);
    t.true(t.context.databaseUnlockStub.calledOnce);
    t.false(t.context.databaseJobAddStub.called);
    t.false(t.context.queueMethodsSendMessageStub.called);
    t.is(result, jobs[0]);
});

test.serial(`if the job exists, the status is neither finish or error, but finished is set, it shouldn't create a new job`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const jobs = t.context.jobs;

    jobs[0].finished = new Date();

    t.context.queueMethodsSendMessageStub = sandbox.spy(queueMethods, 'sendMessage');
    t.context.databaseJobGetByUrlStub = sandbox.stub(database.job, 'getByUrl').resolves(jobs);
    const jobInput = {
        fields: {
            config: null,
            hints: [],
            source: ConfigSource.default,
            url: 'http://webhint.io'
        },
        files: {}
    };

    t.context.databaseJobAddStub = sandbox.spy(database.job, 'add');

    const result = await jobManager.startJob(jobInput);

    t.true(t.context.databaseLockStub.calledOnce);
    t.true(t.context.databaseUnlockStub.calledOnce);
    t.false(t.context.databaseJobAddStub.called);
    t.false(t.context.queueMethodsSendMessageStub.called);
    t.is(result, jobs[0]);
});

test.serial(`if the job is still running, it shouldn't create a new job`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const jobs = t.context.jobs;

    t.context.queueMethodsSendMessageStub = sandbox.spy(queueMethods, 'sendMessage');
    t.context.databaseJobGetByUrlStub = sandbox.stub(database.job, 'getByUrl').resolves(jobs);
    const jobInput = {
        fields: {
            config: null,
            hints: [],
            source: ConfigSource.default,
            url: 'http://webhint.io'
        },
        files: {}
    };

    t.context.databaseJobAddStub = sandbox.spy(database.job, 'add');

    const result = await jobManager.startJob(jobInput);

    t.true(t.context.databaseLockStub.calledOnce);
    t.true(t.context.databaseUnlockStub.calledOnce);
    t.false(t.context.databaseJobAddStub.called);
    t.false(t.context.queueMethodsSendMessageStub.called);
    t.is(result, jobs[0]);


});

test.serial('jobManager.getJob should call to the database to get the job', async (t: TestContext) => {
    await jobManager.getJob('jobId');

    t.true(t.context.databaseJobGetStub.calledOnce);
});

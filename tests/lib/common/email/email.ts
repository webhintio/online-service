import * as path from 'path';

import test, { ExecutionContext } from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

const request = { post(url: string, config: any, callback: Function) { } };

type EmailTestContext = {
    sandbox: sinon.SinonSandbox;
};

type TestContext = ExecutionContext<EmailTestContext>;

test.beforeEach((t: TestContext) => {
    /*
     * We need to use different values for some environment variables
     * so we need to clean the cache before each test.
     */
    delete require.cache[path.resolve(__dirname, '../../../../src/lib/common/email/email.js')];

    const sandbox = sinon.createSandbox();

    t.context.sandbox = sandbox;
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

test.serial(`If host is not defined, we can't send emails`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const requestPostSpy = sandbox.spy(request, 'post');

    process.env.emailUrl = ''; // eslint-disable-line no-process-env

    proxyquire('../../../../src/lib/common/email/email.js', { request });

    const Email = require('../../../../src/lib/common/email/email.js').Email;

    const email = new Email();

    const result = await email.send({});

    t.is(result, null);
    t.false(requestPostSpy.called);
});

test.serial('If host exists, we can send emails', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const requestPostStub = sandbox.stub(request, 'post').callsFake((url, config, callback) => {
        callback(null, { body: { success: true } });
    });

    process.env.emailUrl = 'https://url.com'; // eslint-disable-line no-process-env

    proxyquire('../../../../src/lib/common/email/email.js', { request });

    const Email = require('../../../../src/lib/common/email/email.js').Email;

    const email = new Email();

    await email.send({});

    t.true(requestPostStub.calledOnce);
});

test.serial('If sendEmail fail, it should retry it', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const requestPostStub = sandbox.stub(request, 'post')
        .onFirstCall()
        .callsFake((url, config, callback) => {
            callback(new Error('error'));
        })
        .onSecondCall()
        .callsFake((url, config, callback) => {
            callback(null, { body: { success: true } });
        });

    process.env.emailUrl = 'https://url.com'; // eslint-disable-line no-process-env

    proxyquire('../../../../src/lib/common/email/email.js', { request });

    const Email = require('../../../../src/lib/common/email/email.js').Email;

    const email = new Email();

    await email.send({});

    t.is(requestPostStub.callCount, 2);
});

test.serial('If sendEmail fail 10 times, nothing should happen', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const requestPostStub = sandbox.stub(request, 'post').callsFake((url, config, callback) => {
        callback(new Error('error'));
    });

    process.env.emailUrl = 'https://url.com'; // eslint-disable-line no-process-env

    proxyquire('../../../../src/lib/common/email/email.js', { request });

    const Email = require('../../../../src/lib/common/email/email.js').Email;

    const email = new Email();

    const result = await email.send({});

    t.is(result, null);
    t.is(requestPostStub.callCount, 10);
});

import * as path from 'path';

import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

const request = { post() { } };

test.beforeEach((t) => {
    /*
     * We need to use different values for some environment variables
     * so we need to clean the cache before each test.
     */
    delete require.cache[path.resolve(__dirname, '../../../../src/lib/common/email/email.js')];

    const sandbox = sinon.sandbox.create();

    t.context.sandbox = sandbox;
});

test.afterEach.always((t) => {
    t.context.sandbox.restore();
});

test.serial(`If host is not defined, we can't send emails`, async (t) => {
    const sandbox = t.context.sandbox;

    sandbox.spy(request, 'post');
    t.context.request = request;

    process.env.emailUrl = ''; // eslint-disable-line no-process-env

    proxyquire('../../../../src/lib/common/email/email.js', { request });

    const Email = require('../../../../src/lib/common/email/email.js').Email;

    const email = new Email();

    const result = await email.send({});

    t.is(result, null);
    t.false(t.context.request.post.called);
});

test.serial('If host exists, we can send emails', async (t) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(request, 'post').callsFake((url, config, callback) => {
        callback(null, { body: { success: true } });
    });
    t.context.request = request;

    process.env.emailUrl = 'https://url.com'; // eslint-disable-line no-process-env

    proxyquire('../../../../src/lib/common/email/email.js', { request });

    const Email = require('../../../../src/lib/common/email/email.js').Email;

    const email = new Email();

    await email.send({});

    t.true(t.context.request.post.calledOnce);
});

test.serial('If sendEmail fail, it should retry it', async (t) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(request, 'post')
        .onFirstCall()
        .callsFake((url, config, callback) => {
            callback(new Error('error'));
        })
        .onSecondCall()
        .callsFake((url, config, callback) => {
            callback(null, { body: { success: true } });
        });
    t.context.request = request;

    process.env.emailUrl = 'https://url.com'; // eslint-disable-line no-process-env

    proxyquire('../../../../src/lib/common/email/email.js', { request });

    const Email = require('../../../../src/lib/common/email/email.js').Email;

    const email = new Email();

    await email.send({});

    t.is(t.context.request.post.callCount, 2);
});

test.serial('If sendEmail fail 10 times, nothing should happen', async (t) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(request, 'post').callsFake((url, config, callback) => {
        callback(new Error('error'));
    });
    t.context.request = request;

    process.env.emailUrl = 'https://url.com'; // eslint-disable-line no-process-env

    proxyquire('../../../../src/lib/common/email/email.js', { request });

    const Email = require('../../../../src/lib/common/email/email.js').Email;

    const email = new Email();

    const result = await email.send({});

    t.is(result, null);
    t.is(t.context.request.post.callCount, 10);
});

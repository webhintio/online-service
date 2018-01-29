import * as path from 'path';

import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

const transporter = { sendMail() { } };

const nodemailer = { createTransport() { } };

test.beforeEach((t) => {
    /*
     * We need to use different values for some environment variables
     * so we need to clean the cache before each test.
     */
    delete require.cache[path.resolve(__dirname, '../../../../src/lib/common/email/email.js')];

    const sandbox = sinon.sandbox.create();

    t.context.sandbox = sandbox;
    sandbox.stub(nodemailer, 'createTransport').returns(transporter);
});

test.afterEach.always((t) => {
    t.context.sandbox.restore();
});

test.serial(`If host is not defined, we can't send emails`, async (t) => {
    const sandbox = t.context.sandbox;

    sandbox.spy(transporter, 'sendMail');
    t.context.transporter = transporter;

    process.env.smtpHost = ''; // eslint-disable-line no-process-env

    proxyquire('../../../../src/lib/common/email/email.js', { nodemailer });

    const Email = require('../../../../src/lib/common/email/email.js').Email;

    const email = new Email();

    const result = await email.send({});

    t.is(result, null);
    t.false(t.context.transporter.sendMail.called);
});

test.serial('If host exists, we can send emails', async (t) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(transporter, 'sendMail').callsFake((config, callback) => {
        callback(null, 'ok');
    });
    t.context.transporter = transporter;

    process.env.smtpHost = 'smtp.host.com'; // eslint-disable-line no-process-env

    proxyquire('../../../../src/lib/common/email/email.js', { nodemailer });

    const Email = require('../../../../src/lib/common/email/email.js').Email;

    const email = new Email();

    await email.send({});

    t.true(t.context.transporter.sendMail.calledOnce);
});

test.serial('If sendEmail fail, it should retry it', async (t) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(transporter, 'sendMail')
    .onFirstCall()
    .callsFake((config, callback) => {
        callback(new Error('error'));
    })
    .onSecondCall()
    .callsFake((config, callback) => {
        callback(null, 'ok');
    });
    t.context.transporter = transporter;

    process.env.smtpHost = 'smtp.host.com'; // eslint-disable-line no-process-env

    proxyquire('../../../../src/lib/common/email/email.js', { nodemailer });

    const Email = require('../../../../src/lib/common/email/email.js').Email;

    const email = new Email();

    await email.send({});

    t.is(t.context.transporter.sendMail.callCount, 2);
});

test.serial('If sendEmail fail 10 times, nothing should happen', async (t) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(transporter, 'sendMail').callsFake((config, callback) => {
        callback(new Error('error'));
    });
    t.context.transporter = transporter;

    process.env.smtpHost = 'smtp.host.com'; // eslint-disable-line no-process-env

    proxyquire('../../../../src/lib/common/email/email.js', { nodemailer });

    const Email = require('../../../../src/lib/common/email/email.js').Email;

    const email = new Email();

    const result = await email.send({});

    t.is(result, null);
    t.is(t.context.transporter.sendMail.callCount, 10);
});

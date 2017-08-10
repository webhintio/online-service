import * as path from 'path';

import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

const multiparty = { Form() { } };

const multipartyObject = { parse() { } };

proxyquire('../../../src/lib/utils/misc', { multiparty });

import { getDataFromRequest, readFileAsync } from '../../../src/lib/utils/misc';

test.beforeEach((t) => {
    sinon.stub(multiparty, 'Form').returns(multipartyObject);

    t.context.multiparty = multiparty;
    t.context.multipartyObject = multipartyObject;
});

test.afterEach.always((t) => {
    t.context.multiparty.Form.restore();
    t.context.multipartyObject.parse.restore();
});

test.serial('getDataFromRequest should fail if there is an error parsing', async (t) => {
    const errorMessage = 'error parsing data';

    sinon.stub(multipartyObject, 'parse').callsArgWith(1, errorMessage);

    t.plan(3);
    try {
        await getDataFromRequest({} as any);
    } catch (err) {
        t.true(t.context.multiparty.Form.calledOnce);
        t.true(t.context.multipartyObject.parse.calledOnce);
        t.is(err, errorMessage);
    }
});

test.serial('getDataFromRequest should fail if url is not present', async (t) => {
    sinon.stub(multipartyObject, 'parse').callsArgWith(1, null, { noUrlField: 'nourl' });

    t.plan(3);
    try {
        await getDataFromRequest({} as any);
    } catch (err) {
        t.true(t.context.multiparty.Form.calledOnce);
        t.true(t.context.multipartyObject.parse.calledOnce);
        t.is(err, 'Url is required');
    }
});

test.serial('getDataFromRequest should return data.config to null if there is no file', async (t) => {
    const fields = {
        rules: [],
        source: ['manual'],
        url: ['http://url.com']
    };

    sinon.stub(multipartyObject, 'parse').callsArgWith(1, null, fields, {});

    const data = await getDataFromRequest({} as any);

    t.is(data.config, null);
});

test.serial('getDataFromRequest should return source default if source is not in the request data', async (t) => {
    const fields = {
        rules: [],
        url: ['http://url.com']
    };

    sinon.stub(multipartyObject, 'parse').callsArgWith(1, null, fields, {});

    const data = await getDataFromRequest({} as any);

    t.is(data.source, 'default');
});

test.serial('getDataFromRequest should return the configuration if a file is in the request', async (t) => {
    const configPath = path.join(__dirname, 'fixtures', 'config.json');
    const fields = {
        rules: [],
        source: ['manual'],
        url: ['http://url.com']
    };
    const files = {
        'config-file': [{
            path: configPath,
            size: 1
        }]
    };

    const expected = JSON.parse(await readFileAsync(configPath));

    sinon.stub(multipartyObject, 'parse').callsArgWith(1, null, fields, files);

    const data = await getDataFromRequest({} as any);

    t.deepEqual(data.config, expected);
});

test.serial('if something goes wrong reading the file, a exception sould be thown', async (t) => {
    const configPath = path.join(__dirname, 'fixtures', 'invalid');
    const fields = {
        rules: [],
        source: ['manual'],
        url: ['http://url.com']
    };
    const files = {
        'config-file': [{
            path: configPath,
            size: 1
        }]
    };

    sinon.stub(multipartyObject, 'parse').callsArgWith(1, null, fields, files);

    t.plan(3);
    try {
        await getDataFromRequest({} as any);
    } catch (err) {
        t.true(t.context.multiparty.Form.calledOnce);
        t.true(t.context.multipartyObject.parse.calledOnce);
        t.is(err, 'Error parsing form');
    }
});

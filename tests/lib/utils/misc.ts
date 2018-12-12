import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

type MultiPartyObject = {
    parse: () => void;
};

type Multipoarty = {
    Form: () => MultiPartyObject;
};

const multipartyObject: MultiPartyObject = { parse(): void { } };

const multiparty: Multipoarty = {
    Form() {
        return multipartyObject;
    }
};

proxyquire('../../../src/lib/utils/misc', { multiparty });

import { getDataFromRequest } from '../../../src/lib/utils/misc';

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

test.serial('getDataFromRequest should return and object with the properties fields and files', async (t) => {
    const fields = {
        hints: [],
        source: ['manual'],
        url: ['http://url.com']
    };

    const files = {
        'config-file': {
            path: 'path/to/file',
            size: 15
        }
    };

    sinon.stub(multipartyObject, 'parse').callsArgWith(1, null, fields, files);

    const data = await getDataFromRequest({} as any);

    t.deepEqual(data.fields, fields);
    t.deepEqual(data.files, files);
});

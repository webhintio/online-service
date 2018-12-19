import test, { ExecutionContext } from 'ava';
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

type MiscTestContext = {
    sandbox: sinon.SinonSandbox;
    multipartyFormStub: sinon.SinonStub;
};

type TestContext = ExecutionContext<MiscTestContext>;

proxyquire('../../../src/lib/utils/misc', { multiparty });

import { getDataFromRequest } from '../../../src/lib/utils/misc';

test.beforeEach((t: TestContext) => {
    const sandbox = sinon.createSandbox();
    const stub = sandbox.stub(multiparty, 'Form').returns(multipartyObject);

    t.context.multipartyFormStub = stub;
    t.context.sandbox = sandbox;
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

test.serial('getDataFromRequest should fail if there is an error parsing', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const errorMessage = 'error parsing data';

    const multipartyObjectParseStub = sandbox.stub(multipartyObject, 'parse').callsArgWith(1, errorMessage);

    t.plan(3);
    try {
        await getDataFromRequest({} as any);
    } catch (err) {
        t.true(t.context.multipartyFormStub.calledOnce);
        t.true(multipartyObjectParseStub.calledOnce);
        t.is(err, errorMessage);
    }

    multipartyObjectParseStub.restore();
});

test.serial('getDataFromRequest should return and object with the properties fields and files', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
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

    const errorMessage = 'error parsing data';

    const multipartyObjectParseStub = sandbox.stub(multipartyObject, 'parse').callsArgWith(1, null, fields, files);

    const data = await getDataFromRequest({} as any);

    t.deepEqual(data.fields, fields);
    t.deepEqual(data.files, files);

    multipartyObjectParseStub.restore();
});

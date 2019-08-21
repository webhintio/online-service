import anyTest, { TestInterface } from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import { validateConfig } from 'hint/dist/src/lib/config/config-validator';

type ConfigValidator = {
    validateConfig: () => boolean;
}

type Utils = {
    normalizeHints: () => any;
}

type MiscContext = {
    configValidator: ConfigValidator;
    sandbox: sinon.SinonSandbox;
    utils: Utils;
}

const test = anyTest as TestInterface<MiscContext>;

const loadScript = (context: MiscContext) => {
    return proxyquire('../../../src/lib/utils/misc', {
        '@hint/utils': context.utils,
        'hint/dist/src/lib/config/config-validator': context.configValidator
    });
};

test.beforeEach((t) => {
    t.context.sandbox = sinon.createSandbox();

    t.context.utils = { normalizeHints() { } };
    t.context.configValidator = {
        validateConfig() {
            return false;
        }
    };
});

test.afterEach.always((t) => {
    t.context.sandbox.restore();
});

test('validateServiceConfig should fail if at least one of the configuration is not valid', (t) => {
    const sandbox = t.context.sandbox;

    const validateConfigStub = sandbox.stub(t.context.configValidator, 'validateConfig');
    const normalizehintsStub = sandbox.stub(t.context.utils, 'normalizeHints').returns({
        hint1: '',
        hint2: ''
    });

    validateConfigStub
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);

    const misc = loadScript(t.context);

    t.throws(() => {
        misc.validateServiceConfig([{}, {}]);
    });
    t.true(validateConfigStub.calledTwice);
    t.true(normalizehintsStub.calledOnce);
});

test('validateServiceConfig should fail if configurations has repeated hints', (t) => {
    const sandbox = t.context.sandbox;

    const validateConfigStub = sandbox.stub(t.context.configValidator, 'validateConfig').returns(true);
    const normalizehintsStub = sandbox.stub(t.context.utils, 'normalizeHints').returns({
        hint1: '',
        hint2: ''
    });

    const misc = loadScript(t.context);

    t.throws(() => {
        misc.validateServiceConfig([{}, {}]);
    }, 'Hint hint1 repeated');
    t.true(validateConfigStub.calledTwice);
    t.true(normalizehintsStub.calledTwice);
});

test('validateServiceConfig works if all configurations are valid', (t) => {
    const sandbox = t.context.sandbox;

    const validateConfigStub = sandbox.stub(t.context.configValidator, 'validateConfig').returns(true);
    const normalizehintsStub = sandbox.stub(t.context.utils, 'normalizeHints');

    normalizehintsStub
        .onFirstCall()
        .returns({
            hint1: '',
            hint2: ''
        })
        .onSecondCall()
        .returns({
            hint3: '',
            hint4: ''
        });

    const misc = loadScript(t.context);

    misc.validateServiceConfig([{}, {}]);

    t.true(validateConfigStub.calledTwice);
    t.true(normalizehintsStub.calledTwice);
});

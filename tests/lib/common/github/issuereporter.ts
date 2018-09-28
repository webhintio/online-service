import test from 'ava';
import * as moment from 'moment';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

const Octokit = function () {
};

Octokit.prototype.authenticate = () => { };
Octokit.prototype.issues = {
    create() { },
    createComment() { },
    edit() { }
};
Octokit.prototype.search = { issues() { } };

proxyquire('../../../../src/lib/common/github/issuereporter', { '@octokit/rest': Octokit });

import { IssueReporter } from '../../../../src/lib/common/github/issuereporter';

test.serial('If no error and no issue, nothing happens', async (t) => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(Octokit.prototype.search, 'issues').resolves({ data: { items: [] } });
    sandbox.spy(Octokit.prototype.issues, 'edit');
    sandbox.spy(Octokit.prototype.issues, 'create');

    t.context.search = Octokit.prototype.search;
    t.context.issues = Octokit.prototype.issues;

    const issueReporter = new IssueReporter();

    await issueReporter.report({ configs: [], scan: moment().format('YYYY-MM-DD'), url: 'http://example.com' });

    t.true(t.context.search.issues.called);
    t.false(t.context.issues.edit.called);
    t.false(t.context.issues.create.called);

    sandbox.restore();
});

test.serial('If no error but issue exists, it should close the issue', async (t) => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(Octokit.prototype.search, 'issues').resolves({ data: { items: [{ number: 1 }] } });
    sandbox.stub(Octokit.prototype.issues, 'edit').resolves();
    sandbox.spy(Octokit.prototype.issues, 'create');

    t.context.search = Octokit.prototype.search;
    t.context.issues = Octokit.prototype.issues;

    const issueReporter = new IssueReporter();

    await issueReporter.report({ configs: [], scan: moment().format('YYYY-MM-DD'), url: 'http://example.com' });

    t.true(t.context.search.issues.called);
    t.true(t.context.issues.edit.calledOnce);
    t.false(t.context.issues.create.called);

    const args = t.context.issues.edit.args[0][0];

    t.is(args.state, 'closed');
    t.is(args.number, 1);

    sandbox.restore();
});

test.serial(`If there is an error and issue doesn't exists yet, it should create issue`, async (t) => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(Octokit.prototype.search, 'issues').resolves({ data: { items: [] } });
    sandbox.spy(Octokit.prototype.issues, 'edit');
    sandbox.stub(Octokit.prototype.issues, 'create').resolves();

    t.context.search = Octokit.prototype.search;
    t.context.issues = Octokit.prototype.issues;

    const issueReporter = new IssueReporter();
    const errorMessage = 'Error running webhint';

    await issueReporter.report({
        configs: [{
            connector: { name: 'chrome' },
            hints: { axe: 'error' }
        }],
        errorMessage,
        errorType: 'crash',
        scan: moment().format('YYYY-MM-DD'),
        url: 'http://example.com'
    });

    t.true(t.context.search.issues.called);
    t.false(t.context.issues.edit.called);
    t.true(t.context.issues.create.calledOnce);

    const args = t.context.issues.create.args[0][0];

    t.true(args.body.includes(errorMessage));
    t.true(args.body.includes('"axe": "error"'));

    sandbox.restore();
});

test.serial(`If there is an error and issue exists, it should create a comment`, async (t) => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(Octokit.prototype.search, 'issues').resolves({
        data: {
            items: [{
                labels: [{ name: 'error:crash' }],
                number: 1
            }]
        }
    });
    sandbox.spy(Octokit.prototype.issues, 'edit');
    sandbox.spy(Octokit.prototype.issues, 'create');
    sandbox.stub(Octokit.prototype.issues, 'createComment').resolves();

    t.context.search = Octokit.prototype.search;
    t.context.issues = Octokit.prototype.issues;

    const issueReporter = new IssueReporter();
    const errorMessage = 'Error running webhint';
    const scan = moment().format('YYYY-MM-DD');

    await issueReporter.report({
        configs: [{
            connector: { name: 'chrome' },
            hints: { hint2: 'warning' }
        }],
        errorMessage,
        errorType: 'crash',
        scan,
        url: 'http://example.com'
    });

    t.true(t.context.search.issues.called);
    t.true(t.context.issues.edit.calledOnce);
    t.false(t.context.issues.create.called);
    t.true(t.context.issues.createComment.calledOnce);

    const args = t.context.issues.createComment.args[0][0];

    t.true(args.body.includes(errorMessage));
    t.true(args.body.includes('"hint2": "warning"'));
    t.is(args.number, 1);

    const editArgs = t.context.issues.edit.args[0][0];

    t.true(editArgs.labels.includes(`scan:${scan}`));
    t.true(editArgs.labels.includes('error:crash'));
    t.is(editArgs.number, 1);

    sandbox.restore();
});

test.serial(`If there is an error and the issue exists but the error label is different, it should create a new issue`, async (t) => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(Octokit.prototype.search, 'issues').resolves({
        data: {
            items: [{
                labels: [{ name: 'error:crash' }],
                number: 1
            }]
        }
    });
    sandbox.spy(Octokit.prototype.issues, 'edit');
    sandbox.stub(Octokit.prototype.issues, 'create').resolves();
    sandbox.spy(Octokit.prototype.issues, 'createComment');

    t.context.search = Octokit.prototype.search;
    t.context.issues = Octokit.prototype.issues;

    const issueReporter = new IssueReporter();
    const errorMessage = 'Error running webhint';
    const scan = moment().format('YYYY-MM-DD');

    await issueReporter.report({
        configs: [{
            connector: { name: 'chrome' },
            hints: { axe: 'error' }
        }],
        errorMessage,
        errorType: 'stderr',
        scan,
        url: 'http://example.com'
    });

    t.true(t.context.search.issues.called);
    t.false(t.context.issues.edit.called);
    t.true(t.context.issues.create.calledOnce);
    t.false(t.context.issues.createComment.called);

    const args = t.context.issues.create.args[0][0];

    t.true(args.body.includes(errorMessage));
    t.true(args.body.includes('"axe": "error"'));

    sandbox.restore();
});

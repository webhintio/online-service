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
    update() { }
};

type OctokitSearch = {
    issues: () => Promise<any>;
};

Octokit.prototype.search = {
    issues(): Promise<any> {
        return null;
    }
};

proxyquire('../../../../src/lib/common/github/issuereporter', { '@octokit/rest': Octokit });

import { IssueReporter } from '../../../../src/lib/common/github/issuereporter';

test.serial('If no error and no issue, nothing happens', async (t) => {
    const sandbox = sinon.createSandbox();

    const octokitSearchIssuesStub = sandbox.stub<OctokitSearch, 'issues'>(Octokit.prototype.search, 'issues').resolves({ data: { items: [] } });
    const octokitIssuesUpdateSpy = sandbox.spy(Octokit.prototype.issues, 'update');
    const octokitIssuesCreateSpy = sandbox.spy(Octokit.prototype.issues, 'create');
    const issueReporter = new IssueReporter();

    await issueReporter.report({ configs: [], scan: moment().format('YYYY-MM-DD'), url: 'http://example.com' });

    t.true(octokitSearchIssuesStub.called);
    t.false(octokitIssuesUpdateSpy.called);
    t.false(octokitIssuesCreateSpy.called);

    sandbox.restore();
});

test.serial('If no error but issue exists, it should close the issue', async (t) => {
    const sandbox = sinon.createSandbox();

    const octokitSearchIssuesStub = sandbox.stub<OctokitSearch, 'issues'>(Octokit.prototype.search, 'issues').resolves({ data: { items: [{ issue_number: 1 }] } }); // eslint-disable-line camelcase
    const octokitIssuesUpdateStub = sandbox.stub(Octokit.prototype.issues, 'update').resolves();
    const octokitIssuesCreateSpy = sandbox.spy(Octokit.prototype.issues, 'create');
    const issueReporter = new IssueReporter();

    await issueReporter.report({ configs: [], scan: moment().format('YYYY-MM-DD'), url: 'http://example.com' });

    t.true(octokitSearchIssuesStub.called);
    t.true(octokitIssuesUpdateStub.calledOnce);
    t.false(octokitIssuesCreateSpy.called);

    const args = octokitIssuesUpdateStub.args[0][0];

    t.is(args.state, 'closed');
    t.is(args.number, 1);

    sandbox.restore();
});

test.serial(`If there is an error and issue doesn't exists yet, it should create issue`, async (t) => {
    const sandbox = sinon.createSandbox();

    const octokitSearchIssuesStub = sandbox.stub<OctokitSearch, 'issues'>(Octokit.prototype.search, 'issues').resolves({ data: { items: [] } });
    const octokitIssuesUpdateSpy = sandbox.spy(Octokit.prototype.issues, 'update');
    const octokitIssuesCreateStub = sandbox.stub(Octokit.prototype.issues, 'create').resolves();
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

    t.true(octokitSearchIssuesStub.called);
    t.false(octokitIssuesUpdateSpy.called);
    t.true(octokitIssuesCreateStub.calledOnce);

    const args = octokitIssuesCreateStub.args[0][0];

    t.true(args.body.includes(errorMessage));
    t.true(args.body.includes('"axe": "error"'));

    sandbox.restore();
});

test.serial(`If there is an error and issue exists, it should create a comment`, async (t) => {
    const sandbox = sinon.createSandbox();

    const octokitSearchIssuesStub = sandbox.stub<OctokitSearch, 'issues'>(Octokit.prototype.search, 'issues').resolves({
        data: {
            items: [{
                issue_number: 1, // eslint-disable-line camelcase
                labels: [{ name: 'error:crash' }]
            }]
        }
    });
    const octokitIssuesUpdateSpy = sandbox.spy(Octokit.prototype.issues, 'update');
    const octokitIssuesCreateSpy = sandbox.spy(Octokit.prototype.issues, 'create');
    const octokitIssuesCreateCommentStub = sandbox.stub(Octokit.prototype.issues, 'createComment').resolves();

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

    t.true(octokitSearchIssuesStub.called);
    t.true(octokitIssuesUpdateSpy.calledOnce);
    t.false(octokitIssuesCreateSpy.called);
    t.true(octokitIssuesCreateCommentStub.calledOnce);

    const args = octokitIssuesCreateCommentStub.args[0][0];

    t.true(args.body.includes(errorMessage));
    t.true(args.body.includes('"hint2": "warning"'));
    t.is(args.number, 1);

    const editArgs = octokitIssuesUpdateSpy.args[0][0];

    t.true(editArgs.labels.includes(`scan:${scan}`));
    t.true(editArgs.labels.includes('error:crash'));
    t.is(editArgs.number, 1);

    sandbox.restore();
});

test.serial(`If there is an error and the issue exists but the error label is different, it should create a new issue`, async (t) => {
    const sandbox = sinon.createSandbox();

    const octokitSearchIssues = sandbox.stub<OctokitSearch, 'issues'>(Octokit.prototype.search, 'issues').resolves({
        data: {
            items: [{
                labels: [{ name: 'error:crash' }],
                number: 1
            }]
        }
    });
    const octokitIssuesUpdateSpy = sandbox.spy(Octokit.prototype.issues, 'update');
    const octokitIssuesCreateSpy = sandbox.stub(Octokit.prototype.issues, 'create').resolves();
    const octokitIssuesCreateCommentStub = sandbox.spy(Octokit.prototype.issues, 'createComment');
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

    t.true(octokitSearchIssues.called);
    t.false(octokitIssuesUpdateSpy.called);
    t.true(octokitIssuesCreateSpy.calledOnce);
    t.false(octokitIssuesCreateCommentStub.called);

    const args = octokitIssuesCreateSpy.args[0][0];

    t.true(args.body.includes(errorMessage));
    t.true(args.body.includes('"axe": "error"'));

    sandbox.restore();
});

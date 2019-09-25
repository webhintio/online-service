import anyTest, { TestInterface } from 'ava';
import * as moment from 'moment';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

type OctokitSearch = {
    issues: () => Promise<any>;
};

type IssueReporterContext = {
    Octokit: () => void;
    sandbox: sinon.SinonSandbox;
}

const test = anyTest as TestInterface<IssueReporterContext>;

const loadScript = (context: IssueReporterContext) => {
    return proxyquire('../../../../src/lib/common/github/issuereporter', { '@octokit/rest': context.Octokit }).IssueReporter;
};

test.beforeEach((t) => {
    t.context.sandbox = sinon.createSandbox();

    const Octokit = function () {
    };

    Octokit.prototype.authenticate = () => { };
    Octokit.prototype.issues = {
        create() { },
        createComment() { },
        update() { }
    };
    Octokit.prototype.search = {
        issues(): Promise<any> {
            return null as any;
        }
    };

    t.context.Octokit = Octokit;
});

test('If no error and no issue, nothing happens', async (t) => {
    const sandbox = t.context.sandbox;
    const Octokit = t.context.Octokit;

    const octokitSearchIssuesStub = sandbox.stub<OctokitSearch, 'issues'>(Octokit.prototype.search, 'issues').resolves({ data: { items: [] } });
    const octokitIssuesUpdateSpy = sandbox.spy(Octokit.prototype.issues, 'update');
    const octokitIssuesCreateSpy = sandbox.spy(Octokit.prototype.issues, 'create');
    const IssueReporter = loadScript(t.context);
    const issueReporter = new IssueReporter();

    await issueReporter.report({ configs: [], scan: moment().format('YYYY-MM-DD'), url: 'http://example.com' });

    t.true(octokitSearchIssuesStub.called);
    t.false(octokitIssuesUpdateSpy.called);
    t.false(octokitIssuesCreateSpy.called);

    sandbox.restore();
});

test('If no error but issue exists, it should close the issue', async (t) => {
    const sandbox = t.context.sandbox;
    const Octokit = t.context.Octokit;

    const octokitSearchIssuesStub = sandbox.stub<OctokitSearch, 'issues'>(Octokit.prototype.search, 'issues').resolves({ data: { items: [{ number: 1 }] } });
    const octokitIssuesUpdateStub = sandbox.stub(Octokit.prototype.issues, 'update').resolves();
    const octokitIssuesCreateSpy = sandbox.spy(Octokit.prototype.issues, 'create');
    const IssueReporter = loadScript(t.context);
    const issueReporter = new IssueReporter();

    await issueReporter.report({ configs: [], scan: moment().format('YYYY-MM-DD'), url: 'http://example.com' });

    t.true(octokitSearchIssuesStub.called);
    t.true(octokitIssuesUpdateStub.calledOnce);
    t.false(octokitIssuesCreateSpy.called);

    const args = octokitIssuesUpdateStub.args[0][0];

    t.is(args.state, 'closed');
    t.is(args.issue_number, 1);

    sandbox.restore();
});

test(`If there is an error and issue doesn't exists yet, it should create issue`, async (t) => {
    const sandbox = t.context.sandbox;
    const Octokit = t.context.Octokit;
    const octokitSearchIssuesStub = sandbox.stub<OctokitSearch, 'issues'>(Octokit.prototype.search, 'issues').resolves({ data: { items: [] } });
    const octokitIssuesUpdateSpy = sandbox.spy(Octokit.prototype.issues, 'update');
    const octokitIssuesCreateStub = sandbox.stub(Octokit.prototype.issues, 'create').resolves();
    const IssueReporter = loadScript(t.context);
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

test(`If there is an error and issue exists, it should create a comment`, async (t) => {
    const sandbox = t.context.sandbox;
    const Octokit = t.context.Octokit;
    const octokitSearchIssuesStub = sandbox.stub<OctokitSearch, 'issues'>(Octokit.prototype.search, 'issues').resolves({
        data: {
            items: [{
                labels: [{ name: 'error:timeout' }],
                number: 1
            }]
        }
    });
    const octokitIssuesUpdateSpy = sandbox.spy(Octokit.prototype.issues, 'update');
    const octokitIssuesCreateSpy = sandbox.spy(Octokit.prototype.issues, 'create');
    const octokitIssuesCreateCommentStub = sandbox.stub(Octokit.prototype.issues, 'createComment').resolves();
    const IssueReporter = loadScript(t.context);
    const issueReporter = new IssueReporter();
    const errorMessage = 'Error running webhint';
    const scan = moment().format('YYYY-MM-DD');

    try {
        await issueReporter.report({
            configs: [{
                connector: { name: 'chrome' },
                hints: { hint2: 'warning' }
            }],
            errorMessage,
            errorType: 'timeout',
            scan,
            url: 'http://example.com'
        });
    } catch (e) {
        console.log(e);
    }
    t.true(octokitSearchIssuesStub.called);
    t.true(octokitIssuesUpdateSpy.calledOnce);
    t.false(octokitIssuesCreateSpy.called);
    t.true(octokitIssuesCreateCommentStub.calledOnce);

    const args = octokitIssuesCreateCommentStub.args[0][0];

    t.true(args.body.includes(errorMessage));
    t.true(args.body.includes('"hint2": "warning"'));
    t.is(args.issue_number, 1);

    const editArgs = octokitIssuesUpdateSpy.args[0][0];

    t.true(editArgs.labels.includes(`scan:${scan}`));
    t.true(editArgs.labels.includes('error:timeout'));
    t.is(editArgs.issue_number, 1);

    sandbox.restore();
});

test(`If there is an error and the issue exists but the error label is different, it should create a new issue`, async (t) => {
    const sandbox = t.context.sandbox;
    const Octokit = t.context.Octokit;
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
    const IssueReporter = loadScript(t.context);
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

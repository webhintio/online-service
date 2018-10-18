import * as Octokit from '@octokit/rest';
import { IssuesEditResponse } from '@octokit/rest';

import { IssueData } from '../../types/issuedata';

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

export class IssueReporter {

    /* eslint-disable no-process-env */
    private GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN;
    private GITHUB_OWNER = process.env.GITHUB_OWNER;
    private GITHUB_REPO = process.env.GITHUB_REPO;
    private GITHUB_DATA;
    /* eslint-enable no-process-env */

    private octokit;

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    public constructor() {
        this.GITHUB_DATA = {
            owner: this.GITHUB_OWNER,
            repo: this.GITHUB_REPO
        };
        this.octokit = new Octokit({
            baseUrl: 'https://api.github.com',
            headers: {
                accept: 'application/vnd.github.v3+json',
                'user-agent': 'webhint'
            },
            timeout: 0
        });

        this.octokit.authenticate({
            token: this.GITHUB_API_TOKEN,
            type: 'oauth'
        });
    }

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    private addIssueComment(issue, issueData: IssueData) {
        return this.octokit.issues.createComment({
            body: this.getErrorMessage(issueData),
            number: issue.number,
            owner: this.GITHUB_OWNER,
            repo: this.GITHUB_REPO
        });

    }

    private async closeIssue(issue: IssuesEditResponse) {
        await this.editIssue({
            number: issue.number,
            state: 'closed'
        });
    }

    private editIssue(configs) {
        return this.octokit.issues.edit(Object.assign(
            {},
            this.GITHUB_DATA,
            configs
        ));
    }

    private getErrorMessage(issueData: IssueData) {
        let errorMessage = '';

        if (issueData.errorMessage) {
            errorMessage = `
## Error:

\`\`\`bash
${issueData.errorMessage}
\`\`\`
`;
        }

        errorMessage += `
## Configuration:

\`\`\`json
${JSON.stringify(issueData.configs, null, 4)}
\`\`\`

## Log:

\`\`\`json
${issueData.log}
\`\`\`
`;

        return errorMessage;
    }

    private getErrorTypeLabel(errorType: string): string {
        return `error:${errorType}`;
    }

    private getScanLabel(scanNumber: string): string {
        return `scan:${scanNumber}`;
    }

    private getEmoji(errorType: "crash" | "stderr" | "timeout") {
        let result;

        switch (errorType) {
            case 'crash':
                result = '💥';
                break;
            case 'timeout':
                result = '⏰';
                break;
            default:
                result = 'stderr';
                break;
        }

        return result;
    }

    private async openIssue(issueData: IssueData) {
        await this.octokit.issues.create(Object.assign(
            {},
            this.GITHUB_DATA,
            {
                body: this.getErrorMessage(issueData),
                labels: [
                    this.getScanLabel(issueData.scan),
                    this.getErrorTypeLabel(issueData.errorType)
                ],
                title: `[${this.getEmoji(issueData.errorType)}] ${issueData.url}`
            }
        ));
    }

    private async searchIssues(q: string) {
        const result = await this.octokit.search.issues({ q });

        return result.data.items;
    }

    public async report(issueData: IssueData) {

        // Get open issues for a given URL.
        /*
         * Note: Search returns 100 results per page, but
         *       the query shouldn't return so many results.
         */
        const issues = await this.searchIssues(`${issueData.url} in:title is:open repo:${this.GITHUB_DATA.owner}/${this.GITHUB_DATA.repo}`);

        // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

        /*
         * If there are no problems in the latest scan run with
         * the given URL, close any existing issues related to it.
         */

        if (!issueData.errorType) {
            for (const issue of issues) {
                await this.closeIssue(issue);
            }

            return;
        }

        // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

        // If there were problems with the URL:

        /*
         * 1) If there is already an issue opened for the same problem,
         *    add a new comment to that issue and update the labels.
         */

        for (const issue of issues) {

            const issueLabels = issue.labels.map((label) => {
                return label.name;
            }) || [];

            if (issueLabels.includes(this.getErrorTypeLabel(issueData.errorType))) {
                await this.addIssueComment(issue, issueData);
                await this.updateIssueLabels(issue, issueLabels.concat(this.getScanLabel(issueData.scan)));

                return;
            }
        }

        // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

        // 2) Otherwise open a new issue.

        await this.openIssue(issueData);
    }

    private async updateIssueLabels(issue: IssuesEditResponse, labels: string[]) {
        await this.editIssue({
            labels,
            number: issue.number
        });
    }
}

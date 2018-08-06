export const job = {
    _id: '59f7674e883f4d2374b9e3a5',
    config: [
        {
            browserslist: [],
            connector: {
                name: 'jsdom',
                options: { waitFor: 5000 }
            },
            formatters: ['summary'],
            hints: {
                'no-disallowed-headers': ['error',
                    {
                        ignore: [
                            'Server'
                        ]
                    }
                ],
                'no-friendly-error-pages': 'off'
            },
            hintsTimeout: 120000
        }
    ],
    error: [],
    finished: new Date('2017-10-30T17:54:36.859Z'),
    hints: [
        {
            category: 'interoperability',
            messages: [],
            name: 'no-friendly-error-pages',
            status: 'pass'
        },
        {
            category: 'security',
            messages: [{
                hintId: 'no-disallowed-headers',
                location: {
                    column: -1,
                    line: -1
                },
                message: `Error message`,
                resource: '',
                severity: 2,
                sourceCode: null
            }, {
                hintId: 'no-disallowed-headers',
                location: {
                    column: -1,
                    line: -1
                },
                message: `Error message`,
                resource: '',
                severity: 1,
                sourceCode: null
            }],
            name: 'no-disallowed-headers',
            status: 'error'
        }
    ],
    id: 'f8c622c9-8888-40cc-8d1a-008c76d52d38',
    queued: new Date('2017-10-30T17:54:22.805Z'),
    started: new Date('2017-10-30T17:54:23.540Z'),
    status: 'finished',
    url: 'https://www.url.com',
    webhintVersion: '0.12.3'
};

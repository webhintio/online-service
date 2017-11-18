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
            rules: {
                'no-disallowed-headers': ['error',
                    {
                        ignore: [
                            'Server'
                        ]
                    }
                ],
                'no-friendly-error-pages': 'off'
            },
            rulesTimeout: 120000
        }
    ],
    error: [],
    finished: new Date('2017-10-30T17:54:36.859Z'),
    id: 'f8c622c9-8888-40cc-8d1a-008c76d52d38',
    queued: new Date('2017-10-30T17:54:22.805Z'),
    rules: [
        {
            category: 'interoperability',
            messages: [],
            name: 'no-friendly-error-pages',
            status: 'pass'
        },
        {
            category: 'security',
            messages: [],
            name: 'no-disallowed-headers',
            status: 'pass'
        }
    ],
    sonarVersion: '0.12.3',
    started: new Date('2017-10-30T17:54:23.540Z'),
    status: 'finished',
    url: 'https://app.demo.diplomasafe.com/da-DK/dip/dc786061808ac501f53e11f216d33604c4188a793/kompetencebaseret-interviewteknik10'
};

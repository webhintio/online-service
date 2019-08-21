import * as appInsights from 'applicationinsights';

let appInsightsClient;

/* istanbul ignore next */
if (process.env.APP_INSIGHTS_KEY) { // eslint-disable-line no-process-env
    appInsights.setup(process.env.APP_INSIGHTS_KEY) // eslint-disable-line no-process-env
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true)
        .setUseDiskRetryCaching(true)
        .start();

    appInsightsClient = appInsights.defaultClient;
} else {
    appInsightsClient = {
        trackException() { },
        trackMetric() { }
    };
}

export const getClient = () => {
    return appInsightsClient;
};

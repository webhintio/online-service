import * as http from 'http';

import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as moment from 'moment';

import * as jobManager from './job-manager';
import * as statusManager from '../../common/status/status';
import * as db from '../../common/database/database';
import { IJob, RequestData } from '../../types';
import * as logger from '../../utils/logging';
import { getDataFromRequest } from '../../utils/misc';

const { auth, database, NODE_ENV: env, port } = process.env; // eslint-disable-line no-process-env
const moduleName: string = 'Job Manager Server';

/** Create a job to scan an url if it doesn't exist. */
const createJob = async (req, res) => {
    try {
        const data: RequestData = await getDataFromRequest(req);

        // validate data.url
        // validate data.config if apply

        const job: IJob = await jobManager.startJob(data);

        return res.send(job);
    } catch (err) {
        logger.error(err, moduleName);

        return res.status(500).send(err);
    }
};

/** Get the status of a job. */
const getJobStatus = async (req, res) => {
    const job: IJob = await jobManager.getJob(req.params.id);

    res.send(job);
};

const getScannerStatus = async (req, res) => {
    const to = moment().subtract(1, 'day');
    const status = await statusManager.getStatus(to.toDate());

    res.send(status);
};

const configureServer = () => {
    const app = express();

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));


    if (env !== 'development') {
        if (!auth) {
            throw new Error('Missing authorization');
        }

        app.use((req, res, next) => {
            if (req.header('authorization') !== `Bearer ${auth}`) {
                return res.sendStatus(401);
            }

            return next();
        });
    }

    app.set('port', port || 3000);

    app.post('/', createJob);
    app.get('/:id', getJobStatus);
    app.get('/status', getScannerStatus);

    return app;
};

/** Initilize the server. */
export const run = () => {
    const app = configureServer();

    return new Promise(async (resolve, reject) => {
        const server = http.createServer(app);

        try {
            await db.connect(database);
        } catch (err) {
            return reject(err);
        }

        server.on('listening', () => {
            logger.log(`Server started on port ${app.get('port')}`, moduleName);
            resolve();
        });

        server.on('error', (e) => {
            logger.error(`Error listening on port ${app.get('port')}`, moduleName);
            reject(e);
        });

        return server.listen(app.get('port'));
    });
};

if (process.argv[1].includes('job-manager-server.js')) {
    run();
}

import * as http from 'http';

import * as bodyParser from 'body-parser';
import * as express from 'express';

import * as jobManager from './job-manager';
import * as db from '../../common/database/database';
import { IJob, RequestData } from '../../types';
import * as logger from '../../utils/logging';
import { getDataFromRequest } from '../../utils/misc';

const { auth, database, NODE_ENV: env, port } = process.env; // eslint-disable-line no-process-env
const app = express();
const moduleName: string = 'Job Manager Server';

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

/** Initilize the server. */
export const run = () => {
    return new Promise(async (resolve, reject) => {
        const server = http.createServer(app);

        const startServer = () => {
            server.listen(app.get('port'));
        };

        try {
            await db.connect(database);
        } catch (err) {
            return reject(err);
        }

        server.on('listening', () => {
            logger.log(`Server started on port ${app.get('port')}`, moduleName);
        });

        server.on('error', (e) => {
            logger.error(`Error listening on port ${app.get('port')}`, moduleName);
            reject(e);
        });

        return startServer();
    });
};

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

// This endpoint is just for testing purpose
// app.get('/', (req, res) => {
//     const path = require('path');

//     res.sendfile(path.join(__dirname, 'test.html'));
// });
app.post('/', createJob);
app.get('/:id', getJobStatus);

if (process.argv[1].includes('job-manager-server.js')) {
    run();
}

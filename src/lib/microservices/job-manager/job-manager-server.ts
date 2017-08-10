import * as http from 'http';

import * as bodyParser from 'body-parser';
import * as express from 'express';

import * as jobManager from './job-manager';
import * as database from '../../common/database/database';
import { IJob } from '../../types/job'; // eslint-disable-line no-unused-vars
import { RequestData } from '../../types/requestdata'; // eslint-disable-line no-unused-vars
import * as logger from '../../utils/logging';
import { getDataFromRequest } from '../../utils/misc';

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('port', process.env.port || 3000); // eslint-disable-line no-process-env

/** Initilize the server. */
export const init = () => {
    return new Promise(async (resolve, reject) => {
        const server = http.createServer(app);

        const startServer = () => {
            server.listen(app.get('port'));
        };

        try {
            await database.connect(process.env.database); // eslint-disable-line no-process-env
        } catch (err) {
            return reject(err);
        }

        server.on('listening', () => {
            logger.log(`Server started on port ${app.get('port')}`);
            resolve();
        });

        server.on('error', (e) => {
            logger.error(`Error listening on port ${app.get('port')}`);
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
        logger.log(err);

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
    init();
}

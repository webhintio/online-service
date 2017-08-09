import * as express from 'express';
import * as fs from 'fs';
import * as http from 'http';

import { options } from '../../cli/options';

const app = express();

app.set('port', 3000);

/** Create a job to scan an url if it doesn't exist */
const createJob = async (req, res) => {
    /*
        1. Lock database by url
        2. Check if the result exists (and it is new) having into account if the configuration is the same
            a) if the result exists => return result
            b) if the result is pending => return the id
            c) if the result doesn't exists => create a new result as pending and return the id
        3. Unlock database by url
     */
};

/** Get the status of a job */
const getJobStatus = async (req, res) => {
    /*
        return result by id
     */
};

const init = () => {
    return new Promise((resolve, reject) => {
        const server = http.createServer(app);

        const startServer = () => {
            server.listen(app.get('port'));
        };

        server.on('listening', () => {
            console.log(`Server started on port ${app.get('port')}`);
            resolve();
        });

        server.on('error', (e) => {
            console.error(`Error listening on port ${app.get('port')}`);
            reject(e);
        });

        return startServer();
    });
};

app.post('/', createJob);
app.get('/:id', getJobStatus);

module.exports = { init };

if (process.argv[1].includes('job-manager-server.js')) {
    init();
}

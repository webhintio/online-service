import * as http from 'http';

import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as moment from 'moment';

import * as statusManager from '../../common/status/status';
import * as db from '../../common/database/database';
import * as logger from '../../utils/logging';

const { database, port } = process.env; // eslint-disable-line no-process-env
const moduleName: string = 'Status Server';

const getStatus = async (req, res) => {
    const to = moment().subtract(1, 'day');
    const status = await statusManager.getStatus(to.toDate());

    res.send(status);
};

/** Configure server */
const configureServer = () => {
    const app = express();

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    app.set('port', parseInt(port, 10) + 2 || 3002);

    app.get('/', getStatus);

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

if (process.argv[1].includes('status-server.js')) {
    run();
}

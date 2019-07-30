import * as http from 'http';
import * as path from 'path';

import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as exphbs from 'express-handlebars';
import * as handlebars from 'handlebars';
import * as methodOverride from 'method-override';
import * as session from 'express-session';
import * as connectMongo from 'connect-mongo';

import * as configManager from './config-manager';
import * as userManager from './user-manager';
import * as statisticsManager from './statistics-manager';
import * as database from '../../common/database/database';
import * as logger from '../../utils/logging';
import * as helpers from '../../utils/helpers';
import { ConfigData } from '../../types';
import { getDataFromRequest } from '../../utils/misc';
import * as passport from './auth/passport';

const moduleName: string = 'Configuration Manager Server';
const { database: connectionString, port, sessionSecret } = process.env; // eslint-disable-line no-process-env

const index = (req, res) => {
    res.render('index');
};

const renderConfigList = async (action, res) => {
    try {
        await action();

        res.render('config', { configs: await configManager.list() });
    } catch (err) {
        res.render('config', {
            configs: await configManager.list(),
            error: err.message
        });
    }
};

const configList = (req, res) => {
    renderConfigList(() => { }, res);
};

const getConfigData = async (req) => {
    const data = await getDataFromRequest(req);
    // The package multiparty returns an array
    // for all the properties, thats why we need
    // the [0]
    const file = data.files.configurations[0];
    const configData: ConfigData = {
        filePath: file.size > 0 ? file.path : null,
        jobCacheTime: data.fields.jobCacheTime[0],
        jobRunTime: data.fields.jobRunTime[0],
        name: data.fields.name[0]
    };

    return configData;
};

const addConfig = (req, res) => {
    renderConfigList(async () => {
        const configData: ConfigData = await getConfigData(req);

        return configManager.add(configData);
    }, res);
};

const activateConfig = (req, res) => {
    renderConfigList(() => {
        const name = req.body.name;

        return configManager.activate(name);
    }, res);
};

const deleteConfig = (req, res) => {
    renderConfigList(() => {
        const name = req.body.name;

        return configManager.remove(name);
    }, res);
};

const showConfig = async (req, res) => {
    const name: string = req.params.name;

    try {
        res.render('config-edit', { config: await configManager.get(name) });
    } catch (err) {
        res.render('config', {
            configs: await configManager.list(),
            error: err.message
        });
    }
};

const editConfig = async (req, res) => {
    const oldName: string = req.params.name;
    const configData: ConfigData = await getConfigData(req);

    try {
        await configManager.edit(oldName, configData);

        res.redirect('/admin/config');
    } catch (err) {
        res.render('config-edit', {
            config: await configManager.get(oldName),
            error: err.messageg
        });
    }
};

const usersList = async (req, res) => {
    res.render('users', { users: await userManager.list() });
};

const addUser = async (req, res) => {
    await userManager.add(req.body.name);

    res.render('users', { users: await userManager.list() });
};

const deleteUser = async (req, res) => {
    let error;

    try {
        await userManager.remove(req.body.name);
    } catch (err) {
        error = err;
    }

    res.render('users', {
        error,
        users: await userManager.list()
    });
};

const generalStatistics = async (req, res) => {
    res.render('statistics', { info: await statisticsManager.info() });
};

const renderJobs = (res, message?: string, error?: string) => {
    res.render('jobs', {
        error,
        message
    });
};

const jobsForm = (req, res) => {
    renderJobs(res);
};

const configureServer = () => {
    const viewsPath: string = path.join(__dirname, 'views');
    const app = express();
    const MongoStore = connectMongo(session);


    const hbs = exphbs.create({
        compilerOptions: { preventIndent: true },
        defaultLayout: 'main',
        handlebars,
        helpers: Object.assign(handlebars.helpers, helpers),
        layoutsDir: `${viewsPath}/layouts`,
        partialsDir: `${viewsPath}/partials`
    });

    app.use('/admin', express.static(__dirname));

    app.engine('handlebars', hbs.engine);
    app.set('view engine', 'handlebars');
    app.set('views', viewsPath);
    app.use(session({
        resave: false,
        saveUninitialized: false,
        secret: sessionSecret, // eslint-disable-line no-process-env
        store: new MongoStore({ url: connectionString })
    }));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    app.use(methodOverride((req) => {
        if (req.body && typeof req.body === 'object' && '_method' in req.body) {
            const method = req.body._method;

            delete req.body._method;

            return method;
        }

        return null;
    }));

    passport.configure(app);
    app.set('port', parseInt(port, 10) + 1 || 3001);

    app.get('/admin', passport.ensureAuthenticated, index);
    app.get('/admin/config', passport.ensureAuthenticated, configList);
    app.post('/admin/config', passport.ensureAuthenticated, addConfig);
    app.put('/admin/config', passport.ensureAuthenticated, activateConfig);
    app.delete('/admin/config', passport.ensureAuthenticated, deleteConfig);
    app.get('/admin/config/edit/:name', passport.ensureAuthenticated, showConfig);
    app.post('/admin/config/edit/:name', passport.ensureAuthenticated, editConfig);
    app.get('/admin/users', passport.ensureAuthenticated, usersList);
    app.post('/admin/users', passport.ensureAuthenticated, addUser);
    app.delete('/admin/users', passport.ensureAuthenticated, deleteUser);
    app.get('/admin/statistics', passport.ensureAuthenticated, generalStatistics);
    app.get('/admin/jobs', passport.ensureAuthenticated, jobsForm);
    
    return app;
};

/** Initilize the server. */
export const run = () => {
    const app = configureServer();

    return new Promise(async (resolve, reject) => {
        const server = http.createServer(app);

        try {
            await database.connect(connectionString);
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

if (process.argv[1].includes('config-manager-server.js')) {
    run();
}

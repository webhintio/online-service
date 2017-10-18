import * as http from 'http';
import * as path from 'path';

import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as exphbs from 'express-handlebars';
import * as handlebars from 'handlebars';
import * as methodOverride from 'method-override';
import * as session from 'express-session';

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
const viewsPath: string = path.join(__dirname, 'views');
const app = express();

const hbs = exphbs.create({
    compilerOptions: { preventIndent: true },
    defaultLayout: 'main',
    handlebars,
    helpers: Object.assign(handlebars.helpers, helpers),
    layoutsDir: `${viewsPath}/layouts`,
    partialsDir: `${viewsPath}/partials`
});

app.use(express.static(__dirname));

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');
app.set('views', viewsPath);
app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: process.env.sessionSecret // eslint-disable-line no-process-env
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
app.set('port', process.env.port || 3000); // eslint-disable-line no-process-env

/** Initilize the server. */
export const run = () => {
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
            logger.log(`Server started on port ${app.get('port')}`, moduleName);
        });

        server.on('error', (e) => {
            logger.error(`Error listening on port ${app.get('port')}`, moduleName);
            reject(e);
        });

        return startServer();
    });
};

const index = (req, res) => {
    res.render('index');
};

const renderConfigAfterAction = async (action, res) => {
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
    renderConfigAfterAction(() => { }, res);
};

const getConfigData = async (req) => {
    const data = await getDataFromRequest(req);
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
    renderConfigAfterAction(async () => {
        const configData: ConfigData = await getConfigData(req);

        return configManager.add(configData);
    }, res);
};

const activateConfig = (req, res) => {
    renderConfigAfterAction(() => {
        const name = req.body.name;

        return configManager.activate(name);
    }, res);
};

const deleteConfig = (req, res) => {
    renderConfigAfterAction(() => {
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

        res.redirect('/config/list');
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

// This endpoint is just for testing purpose
app.get('/', passport.ensureAuthenticated, index);
app.get('/config', passport.ensureAuthenticated, configList);
app.post('/config', passport.ensureAuthenticated, addConfig);
app.put('/config', passport.ensureAuthenticated, activateConfig);
app.delete('/config', passport.ensureAuthenticated, deleteConfig);
app.get('/config/edit/:name', passport.ensureAuthenticated, showConfig);
app.post('/config/edit/:name', passport.ensureAuthenticated, editConfig);
app.get('/users', passport.ensureAuthenticated, usersList);
app.post('/users', passport.ensureAuthenticated, addUser);
app.delete('/users', passport.ensureAuthenticated, deleteUser);
app.get('/statistics', passport.ensureAuthenticated, generalStatistics);

if (process.argv[1].includes('config-manager-server.js')) {
    run();
}

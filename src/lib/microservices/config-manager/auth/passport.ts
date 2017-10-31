import * as passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';

import * as database from '../../../common/database/database';

const { callbackURL, githubId, githubSecret } = process.env; // eslint-disable-line no-process-env

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

/**
 * Register the endpoints for the authentication
 * @param app express app.
 */
const registerEndpoints = (app) => {
    app.get('/login', (req, res) => {
        res.render('login', { user: req.user });
    });

    app.get('/auth/github', passport.authenticate('github', {}), () => { });

    app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), (req, res) => {
        res.redirect('/');
    });

    app.get('/logout', (req, res) => {
        req.logout();
        res.redirect('/');
    });
};

/**
 * Configure express to support authentication.
 * @param app express app
 */
export const configure = (app) => {
    passport.use(new GitHubStrategy({
        callbackURL,
        clientID: githubId,
        clientSecret: githubSecret
    }, async (accessToken, refresToken, profile, done) => {
        const user = await database.getUserByName(profile.username);

        if (!user) {
            return done(new Error('Invalid User'));
        }

        return done(null, user);
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    registerEndpoints(app);
};

/**
 * Check if an user is authenticated or not.
 */
export const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }

    return res.redirect('/login');
};

const setShellJSDefaultConfig = (shell) => {
    shell.config.silent = false;
    shell.config.fatal = false;
};

module.exports = { setShellJSDefaultConfig };

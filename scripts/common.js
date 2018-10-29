const setShellJSDefaultConfig = (shell) => {
    shell.config.silent = true;
    shell.config.fatal = false;
};

module.exports = { setShellJSDefaultConfig };

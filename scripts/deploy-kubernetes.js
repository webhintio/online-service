const path = require('path');

const shell = require('shelljs');
const common = require('./common');

common.setShellJSDefaultConfig(shell);

const getComposeFilePath = (file) => {
    if (file) {
        return path.join(process.cwd(), file);
    }

    return path.join(__dirname, '..', 'compose', 'kubernetes-azure.yaml');
};

const deployKubernetes = (file) => {
    const filePath = getComposeFilePath(file);

    console.log(`Deploying kubernetes using the file: ${filePath}`);

    const child = shell.exec(`kubectl apply -f ${filePath}`);

    console.log(child.stdout);
    console.log(child.stderr);

    if (child.code === 0) {
        console.log(`Kubernetes deployed`);
    } else {
        throw new Error(`Error deploying kubernetes`);
    }
};

module.exports = deployKubernetes;

if (process.argv[1].indexOf('deploy-kubernetes.js') !== -1) {
    deployKubernetes(process.argv[2]);
}

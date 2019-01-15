const path = require('path');

const shell = require('shelljs');
const optionator = require('optionator');

const common = require('./common');

common.setShellJSDefaultConfig(shell);

const options = optionator({
    options: [
        { heading: 'Basic configuration' },
        {
            alias: 'k',
            description: 'Kubernetes config file',
            option: 'kubernetes',
            type: 'String'
        },
        { heading: 'Miscellaneous' },
        {
            alias: 'h',
            description: 'Show help',
            option: 'help',
            type: 'Boolean'
        }
    ],
    prepend: 'node deploy-kubernetes.js --kubernetes <yourkubernetesfile>'
});

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
    const userOptions = options.parse(process.argv);

    const kubernetesFile = userOptions.kubernetes;

    if (!kubernetesFile) {
        console.log(options.generateHelp());

        return;
    }

    deployKubernetes(kubernetesFile);
}

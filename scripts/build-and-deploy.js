const currentVersion = require('./current-version');
const buildImages = require('./build-images');
const uploadImages = require('./upload-images');
const updateConfigFile = require('./update-config-file');
const deployKubernetes = require('./deploy-kubernetes');
const optionator = require('optionator');

const options = optionator({
    options: [
        { heading: 'Basic configuration' },
        {
            alias: 'r',
            description: 'Docker repository',
            option: 'repository',
            type: 'String'
        }, {
            alias: 'k',
            description: 'Kubernetes config file',
            option: 'kubernetes',
            type: 'String'
        }, {
            alias: 'v',
            description: 'New version for images',
            option: 'version',
            type: 'String'
        }, {
            alias: 't',
            description: 'Create worker using the github hint repository instead of the hint npm package',
            option: 'testMode',
            type: 'Boolean'
        },
        { heading: 'Miscellaneous' },
        {
            alias: 'h',
            description: 'Show help',
            option: 'help',
            type: 'Boolean'
        }
    ],
    prepend: 'node build-and-deploy.js --repository <yourrepository> --kubernetes <yourkubernetesfile> --version <newVersion> --testMode'
});

const main = () => {
    const userOptions = options.parse(process.argv);
    const repository = userOptions.repository;
    const kubernetesFile = userOptions.kubernetes;
    const testMode = !!userOptions.testMode;

    if (!repository) {
        console.log(options.generateHelp());

        return;
    }

    let newVersion = userOptions.version;

    if (!newVersion) {
        const version = currentVersion(repository);

        newVersion = version + 1;
    }


    console.log(`New version: ${newVersion}`);

    buildImages(repository, newVersion, testMode);

    uploadImages(repository, newVersion);

    updateConfigFile(repository, newVersion, kubernetesFile);

    deployKubernetes(kubernetesFile);
};

main();

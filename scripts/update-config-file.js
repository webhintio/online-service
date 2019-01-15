const path = require('path');
const fs = require('fs');

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
            description: 'Docker image version',
            option: 'version',
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
    prepend: 'node update-config-file.js --repository <yourrepository> --version <version> --kubernetes <yourkubernetesfile>'
});

const getComposeFilePath = (file) => {
    if (file) {
        return path.join(process.cwd(), file);
    }

    return path.join(__dirname, '..', 'compose', 'kubernetes-azure.yaml');
};

const updateConfigFile = (repository, newVersion, file) => {
    const version = newVersion || 'latest';

    const composeFilePath = getComposeFilePath(file);

    console.log(`Updating file: ${composeFilePath} ...`);

    const currentContent = fs.readFileSync(composeFilePath, { encoding: 'utf-8' }); // eslint-disable-line no-sync

    const finalContent = currentContent.replace(/image:([^/]+)([^:]+:)(.*)/g, `image: ${repository}$2${version}`);

    fs.writeFileSync(composeFilePath, finalContent, { encoding: 'utf-8' }); // eslint-disable-line no-sync

    console.log('Kubernetes config file updated');
};

module.exports = updateConfigFile;

if (process.argv[1].indexOf('update-config-file.js') !== -1) {
    const userOptions = options.parse(process.argv);
    const repository = userOptions.repository;

    if (!repository) {
        console.log(options.generateHelp());

        return;
    }

    updateConfigFile(repository, userOptions.newVersion, userOptions.kubernetes);
}

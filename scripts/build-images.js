const path = require('path');

const shell = require('shelljs');
const optionator = require('optionator');

const images = require('./images');
const common = require('./common');

common.setShellJSDefaultConfig(shell);

const options = optionator({
    options: [
        { heading: 'Basic configuration' },
        {
            alias: 'r',
            description: 'Docker repository',
            option: 'repository',
            type: 'String'
        }, {
            alias: 'v',
            description: 'Docker image version',
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
    prepend: 'node build-images.js --repository <yourrepository> --version <version> --testMode'
});

const getDockerFilesDirectory = () => {
    return path.join(__dirname, '..');
};

const buildImages = (repository, newVersion = '', testMode = false) => {
    const cwd = process.cwd();
    const dockerFilesDirectory = getDockerFilesDirectory();
    const version = newVersion || 'latest';
    const isTest = !!testMode;

    shell.cd(dockerFilesDirectory);

    for (const image of images) {
        const fullImageName = `${repository}/${image.name}:${version}`;

        console.log('');
        console.log(`Building image ${fullImageName} ...`);

        const child = shell.exec(`docker build --file ${image.file} . -t ${fullImageName} ${isTest ? '--build-arg mode=test' : ''}`);

        console.log(child.stdout);
        console.error(child.stderr);

        if (child.code === 0) {
            console.log(`Image ${fullImageName} built.`);
        } else {
            throw new Error(`Error building ${fullImageName}`);
        }
    }

    shell.cd(cwd);
};

module.exports = buildImages;

if (process.argv[1].indexOf('build-images.js') !== -1) {
    const userOptions = options.parse(process.argv);
    const repository = userOptions.repository;

    if (!repository) {
        console.log(options.generateHelp());

        return;
    }

    buildImages(repository, userOptions.version, userOptions.testMode);
}

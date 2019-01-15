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
        },
        { heading: 'Miscellaneous' },
        {
            alias: 'h',
            description: 'Show help',
            option: 'help',
            type: 'Boolean'
        }
    ],
    prepend: 'node upload-images.js --repository <yourrepository> --version <version>'
});

const uploadImages = (repository, newVersion) => {
    const version = newVersion || 'latest';

    for (const image of images) {
        const fullImageName = `${repository}/${image.name}:${version}`;

        console.log('');
        console.log(`Uploading image ${fullImageName} ...`);

        const child = shell.exec(`docker push ${fullImageName}`);

        console.log(child.stdout);
        console.log(child.stderr);

        if (child.code === 0) {
            console.log(`Image ${fullImageName} uploaded.`);
        } else {
            throw new Error(`Error uploading ${fullImageName}`);
        }
    }
};

module.exports = uploadImages;

if (process.argv[1].indexOf('upload-images.js') !== -1) {
    const userOptions = options.parse(process.argv);
    const repository = userOptions.repository;

    if (!repository) {
        console.log(options.generateHelp());

        return;
    }

    uploadImages(repository, userOptions.version);
}

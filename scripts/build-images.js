const path = require('path');

const shell = require('shelljs');
const images = require('./images');

shell.config.silent = true;
shell.config.fatal = false;

const getDockerFilesDirectory = () => {
    return path.join(__dirname, '..');
};

const buildImages = (repository, newVersion) => {
    const dockerFilesDirectory = getDockerFilesDirectory();
    const version = newVersion || 'latest';

    shell.cd(dockerFilesDirectory);

    for (const image of images) {
        const fullImageName = `${repository}/${image.name}:${version}`;

        console.log('');
        console.log(`Building image ${fullImageName} ...`);

        const child = shell.exec(`docker build --file ${image.file} . -t ${fullImageName}`);

        console.log(child.stdout);
        console.error(child.stderr);

        if (child.code === 0) {
            console.log(`Image ${fullImageName} built.`);
        } else {
            throw new Error(`Error building ${fullImageName}`);
        }
    }
};

module.exports = buildImages;

if (process.argv[1].indexOf('build-images.js') !== -1) {
    buildImages(process.argv[2], process.argv[3]);
}

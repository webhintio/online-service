const path = require('path');

const shell = require('shelljs');
const images = require('./images');
const common = require('./common');

common.setShellJSDefaultConfig(shell);

const getDockerFilesDirectory = () => {
    return path.join(__dirname, '..');
};

const buildImages = (repository, newVersion) => {
    const cwd = process.cwd();
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

    shell.cd(cwd);
};

module.exports = buildImages;

if (process.argv[1].indexOf('build-images.js') !== -1) {
    buildImages(process.argv[2], process.argv[3]);
}

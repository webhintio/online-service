const shell = require('shelljs');
const images = require('./images');
const common = require('./common');

common.setShellJSDefaultConfig(shell);

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
    uploadImages(process.argv[2], process.argv[3]);
}

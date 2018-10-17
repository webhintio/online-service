const shell = require('shelljs');

shell.config.silent = true;
shell.config.fatal = false;

const getVersion = (dockerImages) => {
    const tags = dockerImages.reduce((total, dockerImage) => {
        if (!dockerImage) {
            return total;
        }

        const tag = dockerImage.split(/\s+/)[1];

        let versionNumber = parseInt(tag, 10);

        if (!versionNumber) {
            versionNumber = 0;
        }

        total.push(versionNumber);

        return total;
    }, []);

    const descendingTags = tags.sort((a, b) => {
        return b - a;
    });

    // Return the highest version.
    return descendingTags[0] || 0;
};

const currentVersion = (repository) => {
    console.log('Getting current images');

    const dockerImagesString = shell.exec(`docker image ls ${repository}/*`).stdout;

    console.log(dockerImagesString);

    // The first row contains the headers.
    const dockerImages = dockerImagesString.split('\n').slice(1);

    const version = getVersion(dockerImages);

    console.log(`Current version: ${version}`);

    return version;
};

module.exports = currentVersion;

if (process.argv[1].indexOf('current-version.js') !== -1) {
    currentVersion(process.argv[2]);
}

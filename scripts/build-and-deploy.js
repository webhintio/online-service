const currentVersion = require('./current-version');
const buildImages = require('./build-images');
const uploadImages = require('./upload-images');
const updateConfigFile = require('./update-config-file');
const deployKubernetes = require('./deploy-kubernetes');

const main = () => {
    const repository = process.argv[2];

    if (!repository) {
        console.error('Repository required');
        console.log(`Please use ${process.argv[0]} ${process.argv[1]} REPOSITORY [kubernetes file path]`);

        return;
    }

    const version = currentVersion(repository);
    const newVersion = version + 1;

    console.log(`New version: ${newVersion}`);

    buildImages(repository, newVersion);

    uploadImages(repository, newVersion);

    updateConfigFile(repository, newVersion, process.argv[3]);

    deployKubernetes(process.argv[3]);
};

main();

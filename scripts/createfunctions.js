const fs = require('fs');
const rimraf = require('rimraf');

const functions = [
    'status-service',
    'sync-service'
];

const main = () => {
    functions.forEach((fxn) => {
        rimraf.sync(fxn);
        fs.readFile(`${fxn}-function.json`, 'utf-8', (err, data) => {
            if (err) {
                throw (err);
            } else {
                const replacedData = data.replace('dist/', '../dist/');

                if (!fs.exists(fxn)){
                    fs.mkdir(fxn);
                }

                fs.writeFile(`${fxn}/function.json`, replacedData, (err) => {
                    if (err) {
                        throw (err);
                    }
                });
            }
        });
    });
};

main();

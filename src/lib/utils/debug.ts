import * as path from 'path';

import * as d from 'debug';

const debugEnabled: boolean = (process.argv.includes('--debug'));

// must do this initialization *before* other requires in order to work
if (debugEnabled) {
    d.enable('online-service:*');
}

export const debug = (filePath: string): d.IDebugger => {
    let output: string = path.basename(filePath, path.extname(filePath));
    let dirPath: string = path.dirname(filePath);
    let currentDir: string = path.basename(dirPath);

    // The debug message is generated from the file path, e.g.:
    //
    //  * src/lib/microservices/job-manager/job-manager-server.ts => online-service:microservices:job-manager:job-manager-server
    //  * src/lib/microservices/job-manager/job-manager.ts => online-service:microservices:job-manager

    while (currentDir && currentDir !== 'lib') {

        // If the file is in a directory with the same name, do not add
        // its parent directory (this is the case for microservices & common).

        if (currentDir !== output) {
            output = `${currentDir}:${output}`;
        }

        dirPath = path.join(dirPath, '..');
        currentDir = path.basename(dirPath);
    }


    return d(`online-service:${output}`);
};

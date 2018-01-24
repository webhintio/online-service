import * as common from './methods/common';
import * as job from './methods/job';
import * as serviceConfig from './methods/serviceconfig';
import * as status from './methods/status';
import * as user from './methods/user';

const { connect, createLock, disconnect, host, lock, replicaSetStatus, unlock } = common;

export {
    connect,
    createLock,
    disconnect,
    job,
    host,
    lock,
    serviceConfig,
    status,
    replicaSetStatus,
    unlock,
    user
};

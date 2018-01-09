import { Schema } from 'mongoose';

export const StatusSchema: Schema = new Schema({
    average: {},
    date: Date,
    queues: {},
    rules: {},
    scans: {}
}, { usePushEach: true }); // usePushEach for compatibility with mongodb 3.6

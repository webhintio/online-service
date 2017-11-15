import { Schema } from 'mongoose';

export const StatusSchema: Schema = new Schema({
    average: {},
    date: Date,
    queues: {},
    scans: {}
});

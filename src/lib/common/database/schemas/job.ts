import { Schema } from 'mongoose';

export const JobSchema: Schema = new Schema({
    config: {},
    error: String,
    finished: Date,
    id: String,
    queued: Date,
    rules: [{}],
    started: Date,
    status: {},
    url: String
});

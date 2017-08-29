import { Schema } from 'mongoose';

export const ServiceConfigSchema: Schema = new Schema({
    active: Boolean,
    jobCacheTime: Number,
    name: {
        index: { unique: true },
        type: String
    },
    sonarConfig: {}
});

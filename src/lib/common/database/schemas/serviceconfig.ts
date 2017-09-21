import { Schema } from 'mongoose';

export const ServiceConfigSchema: Schema = new Schema({
    active: Boolean,
    jobCacheTime: Number,
    jobRunTime: Number,
    name: {
        index: { unique: true },
        type: String
    },
    sonarConfigs: [{}]
});

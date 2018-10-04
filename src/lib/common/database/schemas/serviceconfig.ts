import { Schema } from 'mongoose';

export const ServiceConfigSchema: Schema = new Schema({
    active: Boolean,
    jobCacheTime: Number,
    jobRunTime: Number,
    name: {
        index: { unique: true },
        type: String
    },
    webhintConfigs: [{}]
}, { usePushEach: true }); // usePushEach for compatibility with mongodb 3.6

import { Schema } from 'mongoose';

export const UserSchema: Schema = new Schema({
    name: {
        index: { unique: true },
        type: String
    }
});

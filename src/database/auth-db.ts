import { getModelForClass, mongoose, prop } from "@typegoose/typegoose";
import { Databases, generateConfig } from "database.js";
import { Role } from "services/auth/auth-models.js";

// Collections within the auth database
enum AuthDB {
    ROLES = "roles",
}

// Class containing auth info
export class AuthInfo {
    @prop({ required: true })
    public _id: string;

    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public provider: string;

    @prop({
        required: true,
        type: () => {
            return Role;
        },
    })
    public roles: Role[];
}

export const AuthInfoModel: mongoose.Model<AuthInfo> = getModelForClass(
    AuthInfo,
    generateConfig(Databases.AUTH_DB, AuthDB.ROLES),
);

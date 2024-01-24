import { prop } from "@typegoose/typegoose";

export class StaffShift {
    @prop({ required: true })
    public userId: string;

    @prop({
        required: true,
        type: () => String,
    })
    public shifts: string[];
}

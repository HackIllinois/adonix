import { prop } from "@typegoose/typegoose";

export class StaffShift {
    @prop({ required: true })
    public _id: string;

    @prop({
        required: true,
        type: () => {
            return String;
        },
    })
    public shifts: string[];
}

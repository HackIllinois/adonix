import { prop } from "@typegoose/typegoose";

export class MentorOfficeHours {
    @prop({ required: true })
    public mentorId: string;

    @prop({ required: true })
    public mentorName: string;

    @prop({
        required: true,
        type: () => {
            return String;
        },
    })
    public attendees: string[];
}

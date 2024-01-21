import { prop } from "@typegoose/typegoose";

export class RegistrationApplication {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public hasSubmitted: boolean;

    @prop({ required: true })
    public isProApplicant: boolean;

    @prop({ required: true })
    public preferredName: string;

    @prop({ required: true })
    public legalName: string;

    @prop({ required: true })
    public emailAddress: string;

    @prop({ required: true })
    public gender: string;

    @prop({
        required: true,
        type: () => String,
    })
    public race: string[];

    // Not required
    public resumeFileName?: string;

    @prop({ required: true })
    public requestedTravelReimbursement: boolean;

    @prop({ required: true })
    public location: string;

    @prop({ required: true })
    public degree: string;

    @prop({ required: true })
    public major: string;

    @prop({ required: false })
    public minor: string;

    @prop({ required: true })
    public university: string;

    @prop({ required: true })
    public gradYear: number;

    @prop({
        required: true,
        type: () => String,
    })
    public hackInterest: string[];

    @prop({
        required: true,
        type: () => String,
    })
    public hackOutreach: string[];

    @prop({
        required: true,
        type: () => String,
    })
    public dietaryRestrictions: string[];

    @prop({ required: true })
    public hackEssay1: string;

    @prop({ required: true })
    public hackEssay2: string;

    @prop({ required: true })
    public optionalEssay?: string;

    @prop({ required: true })
    proEssay?: string;

    @prop({ required: true })
    considerForGeneral?: boolean;
}

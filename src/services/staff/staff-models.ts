import { prop } from "@typegoose/typegoose";





export class EventsAttendedByStaff {
	@prop({ required: true })
		_id: string;

	@prop({
		required: true, type: () => {
			return String;
		},
	})
		attendance: string[];
}

import { Ref, prop, modelOptions } from "@typegoose/typegoose";

// Interface for the location of the event
@modelOptions({ schemaOptions: { _id: false } })
export class Location {
	@prop({ required: true })
	public description: string;

	@prop({ required: true, type: () => {
		return String;
	} })
	public tags: string[];

	@prop({ required: true })
	public latitude: number;

	@prop({ required: true })
	public longitude: number;
}
  
// Interface for the actual event
class BaseEvent {
	@prop({ required: true })
	public _id: string;
	
	@prop({ required: true })
		id: string;

	@prop({ required: true })
		name: string;

	@prop({ required: true })
		description: string;

	@prop({ required: true })
		startTime: number;
	
	@prop({ required: true })
		endTime: number;
	
	@prop({ required: true, type: () => {
		return Location;
	} })
		locations: Ref<Location>[];
	
	@prop({ required: true })
		isAsync: boolean;
	
}

export class EventMetadata {
	@prop({ required: true })
	public id: string;

	@prop({ required: true })
	public isStaff: boolean;

	@prop({ required: true })
	public exp: number;
}

export class PublicEvent extends BaseEvent {
	@prop({ required: true })
		isPrivate: boolean;
	
	@prop({ required: true })
		displayOnStaffCheckIn: boolean;
	
	@prop({ required: true })
		sponsor: string;

	@prop({ required: true })
		points: number;

	@prop({ required: true })
		eventType: string;
}

export class StaffEvent extends BaseEvent {
}

// Enum representing the type of the event
// MEAL, SPEAKER, WORKSHOP, MINIEVENT, QNA, or OTHER
export enum EVENT_TYPE {
	MEAL = "MEAL",
	SPEAKER = "SPEAKER",
	WORKSHOP = "WORKSHOP",
	MINIEVENT = "MINIEVENT",
	QNA = "QNA",
	OTHER = "OTHER",
}

export interface FilteredEventView {
	id: string,
	name: string,
	description: string,
	startTime: number,
	endTime: number,
	locations: Location[],
	sponsor: string,
	eventType: EVENT_TYPE,
	points: number,
	isAsync: boolean,
}

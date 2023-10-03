import { Ref, prop } from "@typegoose/typegoose";

// Interface for the location of the event
export class Location {
	@prop({required: true})
	public description: string;

	@prop({required: true, type: () => String})
	public tags: string[];

	@prop({required: true})
	public latitude: number;

	@prop({required: true})
	public longitude: number;
}
  
// Interface for the actual event
class BaseEvent {
	@prop({required: true})
	id: string;

	@prop({required: true})
	name: string;

	@prop({required: true})
	description: string;

	@prop({required: true})
	startTime: number;
	
	@prop({required: true})
	endTime: number;
	
	@prop({required: true, type: () => Location})
	locations: Ref<Location>[];
	
	@prop({required: true})
	isAsync: boolean;
	
	@prop({required: true})
	isStaff: boolean;
}

export class EventMetadata {
	@prop({required: true})
	public id: string;

	@prop({required: true})
	public isStaff: boolean;

	@prop({required: true})
	public exp: number;
}

export class PublicEvent extends BaseEvent {
	@prop({required: true})
	isPrivate: boolean;
	
	@prop({required: true})
	displayOnStaffCheckIn: boolean;
	
	@prop({required: true})
	sponsor: string;

	@prop({required: true})
	points: number;

	@prop({required: true, type: () => EVENT_TYPE})
	eventType: EVENT_TYPE;
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

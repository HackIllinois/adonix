import { prop, modelOptions } from "@typegoose/typegoose";
import { BaseEventFormat } from "./event-formats";
import { ObjectId } from "mongodb";

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
		locations: Location[];
	
	@prop({ required: true })
		isAsync: boolean;

	constructor (baseEvent: BaseEventFormat) {
		this._id = baseEvent._id ?? new ObjectId().toHexString();
		this.id = this._id;
		this.description = baseEvent.description;
		this.name = baseEvent.name;
		this.startTime = baseEvent.startTime;
		this.endTime = baseEvent.endTime;
		this.locations = baseEvent.locations;
	}
	
}

export class EventMetadata {
	@prop({ required: true })
	public _id: string;
	
	@prop({ required: true })
	public isStaff: boolean;

	@prop({ required: true })
	public exp: number;

	constructor(_id: string, isStaff: boolean, exp: number) {
		this._id = _id;
		this.isStaff = isStaff;
		this.exp = exp;
	}
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

	constructor (baseEvent: BaseEventFormat) {
		super(baseEvent);
		this.isPrivate = baseEvent.isPrivate ?? false;
		this.displayOnStaffCheckIn = baseEvent.displayOnStaffCheckIn ?? false;
		this.sponsor = baseEvent.sponsor ?? "None";
		this.points = baseEvent.points ?? 0;
		this.eventType = baseEvent.eventType ?? "OTHER";
	}
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

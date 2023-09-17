// Interface for the location of the event
export interface Location {
	description: string,
	tags: string[],
	latitude: number,
	longitude: number,
}

// Interface for the actual event
export interface BaseEvent {
	id: string,
	name: string,
	description: string,
	starttime: number,
	endtime: number,
	locations: Location[],
	sponsor: string,
	eventtype: EVENT_TYPE,
	points: number,
	isasync: boolean,
	isprivate: boolean,
	displayonstaffcheckin: boolean,
}

// Interface for the actual event
export interface PublicEvent {
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

export interface PrivateEvent extends PublicEvent {
	isPrivate: boolean,
	displayOnStaffCheckIn: boolean,
}

export type GenericEvent = PrivateEvent | PublicEvent;

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

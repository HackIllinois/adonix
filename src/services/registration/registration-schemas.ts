import { Document, ObjectId, WithId } from "mongodb";


export interface MentorSchema extends WithId<Document> {
	_id: ObjectId,
	id: string,
	firstName: string,
	lastName: string,
	email: string,
	shirtSize: string,
	github: string,
	linkedin: string
}

export enum RegistrationDB {
	ATTENDEES = "attendees",
	MENTORS = "mentors"
}


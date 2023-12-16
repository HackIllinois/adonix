// POST/PUT Request format for adding/updating an Attendee's registration records
export interface UpdateRegistrationRecord {
    userId: string;
    preferredName: string;
    userName: string;
    resume: string;
    essays: string[];
}

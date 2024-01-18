// Enum representing the type of the event

import { Location } from "../../database/event-db.js";

// MEAL, SPEAKER, WORKSHOP, MINIEVENT, QNA, or OTHER
export enum PUBLIC_EVENT_TYPE {
    MEAL = "MEAL",
    SPEAKER = "SPEAKER",
    WORKSHOP = "WORKSHOP",
    MINIEVENT = "MINIEVENT",
    QNA = "QNA",
    OTHER = "OTHER",
}

export enum STAFF_EVENT_TYPE {
    MEETING = "MEETING",
    STAFF_SHIFT = "STAFFSHIFT",
    OTHER = "OTHER",
}

export interface FilteredEventView {
    eventId: string;
    name: string;
    description: string;
    startTime: number;
    endTime: number;
    locations: Location[];
    sponsor?: string;
    eventType: PUBLIC_EVENT_TYPE;
    points: number;
    isAsync: boolean;
    mapImageURL?: string;
}

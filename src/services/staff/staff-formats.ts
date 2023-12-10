// Format for default staff attendance input
export interface AttendanceFormat {
    eventId: string;
}

export interface Location {
    description: string;
    tags: string[];
    latitude: number;
    longitude: number;
}

export interface EventData {
    eventId: string;
    name: string;
    description: string;
    startTime: number;
    endTime: number;
    locations: Location[];
    isAsync: boolean;
}

// Function to generate a single event entry
export function generateEvent(eventId: number): EventData {
    return {
        eventId: "event " + eventId,
        name: "test " + eventId,
        description: "...",
        startTime: 1696467600,
        endTime: 1696471200,
        locations: [
            {
                description: "SIEBEL",
                tags: ["TAG1", "TAG2"],
                latitude: 12,
                longitude: -80,
            },
        ],
        isAsync: false,
    };
}

export function isValidAttendanceFormat(obj: AttendanceFormat): boolean {
    return typeof obj.eventId === "string";
}

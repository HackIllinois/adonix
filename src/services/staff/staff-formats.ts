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
export function generateEvent(): EventData[] {
    const data: EventData[] = [
        {
            eventId: "event 1",
            name: "test 1",
            description: "...",
            startTime: 1708734216,
            endTime: 1708907016,
            locations: [
                {
                    description: "SIEBEL",
                    tags: ["TAG1", "TAG2"],
                    latitude: 12,
                    longitude: -80,
                },
            ],
            isAsync: false,
        },
        {
            eventId: "event 2",
            name: "test 2",
            description: "...",
            startTime: 1708734216,
            endTime: 1708907016,
            locations: [
                {
                    description: "SIEBEL",
                    tags: ["TAG1", "TAG2"],
                    latitude: 12,
                    longitude: -80,
                },
            ],
            isAsync: false,
        },
        {
            eventId: "event 3",
            name: "test 3",
            description: "...",
            startTime: 1708734216,
            endTime: 1708907016,
            locations: [
                {
                    description: "SIEBEL",
                    tags: ["TAG1", "TAG2"],
                    latitude: 12,
                    longitude: -80,
                },
            ],
            isAsync: false,
        },
        {
            eventId: "event 4",
            name: "test 4",
            description: "...",
            startTime: 1708734216,
            endTime: 1708907016,
            locations: [
                {
                    description: "SIEBEL",
                    tags: ["TAG1", "TAG2"],
                    latitude: 12,
                    longitude: -80,
                },
            ],
            isAsync: false,
        },
    ];
    return data;
}

export function isValidAttendanceFormat(obj: AttendanceFormat): boolean {
    return typeof obj.eventId === "string";
}

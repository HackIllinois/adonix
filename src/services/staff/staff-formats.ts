// Format for default staff attendance input
export interface AttendanceFormat {
    eventId: string;
}

export function isValidAttendanceFormat(obj: AttendanceFormat): boolean {
    return typeof obj.eventId === "string";
}

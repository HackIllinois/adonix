import request from "supertest";

import { Provider, Role } from "./services/auth/auth-models.js";

export const TESTER = {
    id: "bob-the-tester101010101011",
    email: "bob-the-tester@hackillinois.org",
    name: "Bob Tester",
};

const AUTH_ROLE_TO_ROLES: Record<Role, Role[]> = {
    [Role.APPLICANT]: [Role.APPLICANT],
    [Role.USER]: [Role.USER],
    [Role.ATTENDEE]: [Role.ATTENDEE],
    [Role.STAFF]: [Role.ATTENDEE, Role.STAFF],
    [Role.ADMIN]: [Role.ATTENDEE, Role.STAFF, Role.ADMIN],

    [Role.MENTOR]: [Role.MENTOR],
    [Role.SPONSOR]: [Role.SPONSOR],
    [Role.BLOBSTORE]: [Role.BLOBSTORE],
};

function setAuth(request: request.Test, role?: Role): request.Test {
    if (!role) {
        return request;
    }

    const isStaff = role == Role.STAFF || role == Role.ADMIN;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { generateJwtToken } = require("./services/auth/auth-lib.js");

    // Assumes auth lib works. Therefore we should have some tests for this.
    const jwt = generateJwtToken({
        id: TESTER.id,
        email: TESTER.email,
        provider: isStaff ? Provider.GOOGLE : Provider.GITHUB,
        roles: AUTH_ROLE_TO_ROLES[role],
    });

    return request.set("Authorization", jwt as string);
}

function app(): Express.Application {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const appExports = require("./app.js");
    appExports.setupServer();
    return appExports.default;
}

export function get(url: string, role?: Role): request.Test {
    return setAuth(request(app()).get(url), role);
}

export function post(url: string, role?: Role): request.Test {
    return setAuth(request(app()).post(url), role);
}

export function put(url: string, role?: Role): request.Test {
    return setAuth(request(app()).put(url), role);
}

export function del(url: string, role?: Role): request.Test {
    return setAuth(request(app()).delete(url), role);
}

// Helpers that are nicer to use

export function getAsAttendee(url: string): request.Test {
    return get(url, Role.ATTENDEE);
}

export function postAsAttendee(url: string): request.Test {
    return post(url, Role.ATTENDEE);
}

export function putAsAttendee(url: string): request.Test {
    return put(url, Role.ATTENDEE);
}

export function delAsAttendee(url: string): request.Test {
    return del(url, Role.ATTENDEE);
}

export function getAsStaff(url: string): request.Test {
    return get(url, Role.STAFF);
}

export function postAsStaff(url: string): request.Test {
    return post(url, Role.STAFF);
}

export function putAsStaff(url: string): request.Test {
    return put(url, Role.STAFF);
}

export function delAsStaff(url: string): request.Test {
    return del(url, Role.STAFF);
}

export function getAsAdmin(url: string): request.Test {
    return get(url, Role.ADMIN);
}

export function postAsAdmin(url: string): request.Test {
    return post(url, Role.ADMIN);
}

export function putAsAdmin(url: string): request.Test {
    return put(url, Role.ADMIN);
}

export function delAsAdmin(url: string): request.Test {
    return del(url, Role.ADMIN);
}

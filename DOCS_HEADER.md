HackIllinois' backend API

## Authentication

**Cookie-Based Authentication**: This API uses HTTP-only cookies for authentication. After logging in, your JWT token will be automatically stored as a secure cookie and sent with subsequent requests.

[Attendee Authentication](https://adonix.hackillinois.org/auth/login/github?redirect=https://adonix.hackillinois.org/docs)
[Staff Authentication](https://adonix.hackillinois.org/auth/login/google?redirect=https://adonix.hackillinois.org/docs)

You can authenticate to test using the two links above - you'll have to do it programmatically in the apps, though.

Authentication is required for most endpoints, and most endpoints have a role requirement as well (staff-only, for example).
You can see these requirements on each endpoint's description.

## Errors
Errors are formatted like:
```json
{
    "error": "NotFound",
    "message": "Couldn't find that",
}
```
Where `error` is a error type that can be compared in code, and `message` is a user-facing message for that error.

This way, handling errors is straight-forward.

## Shared Errors
These error types are **not listed** under endpoints specifically, since each endpoint shares them.

Authentication:
- `NoToken` - you haven't specified a token on an endpoint that requires one
- `TokenInvalid` - the token specified is invalid, try re-logging
- `TokenExpired` - the token has expired, you'll need to log in again
- `Forbidden` - you don't have the role required to use this endpoint

Specification has one key type as well - `BadRequest`.
If you ever get this error code, you're sending a request in the wrong format.
This error will also include information about what information is wrong,
but you should always consult the docs if you get this error to verify.

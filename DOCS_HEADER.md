HackIllinois' backend API

## Authentication

[Attendee Authentication](https://adonix.hackillinois.org/auth/login/github?device=dev)

[Staff Authentication](https://adonix.hackillinois.org/auth/login/google?device=dev)

You can get a JWT to test with using the two links above - you'll have to do it programmatically in the apps, though.

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
- `InvalidToken` - the token specified is invalid, try re-logging
- `TokenExpired` - the token has expired, you'll need to get a new one. To prevent this, use `GET /auth/token/refresh/`.
- `Forbidden` - you don't have the role required to use this endpoint

Specification has one key type as well - `BadRequest`.
If you ever get this error code, you're sending a request in the wrong format.
This error will also include information about what information is wrong,
but you should always consult the docs if you get this error to verify.

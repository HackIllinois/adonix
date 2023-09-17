# adonix
Official repository for API redesign.

## Installation

#### Prerequisites

- `node`
- `yarn`

#### Steps for development environment

1. `yarn install`
2. Install the [EditorConfig plugin](https://editorconfig.org/#download) for your editor if it doesn't support it by default

## To run locally

```
npm run start
```

## To generate local developer docs

```
npm run devdocs
```
(Can be accessed via the docs/index.html file)

## To generate local endpoint docs
```
npm run apidocs
```

#### Default API Docs Documentation:

Endpoints should be documented as such:
```
/**
 * @api {METHOD} SERVICE/ENDPOINT SERVICE/ENDPOINT
 * @apiGroup SERVICE
 * @apiDescription SERVICE DESCRIPTION
 *
 * @apiParam {TYPE} PARAM1 DESC
 * @apiParam {TYPE} PARAM2 DESC
 * @apiParam {TYPE} PARAM3 DESC
 *
 * @apiSuccess (200: Success) {TYPE} NAME1 DESC
 * @apiSuccess (200: Success) {TYPE} NAME2 DESC
 * @apiSuccess (200: Success) {TYPE} NAME3 DESC

 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"NAME1": VALUE1,
 * 		"NAME2": VALUE2,
 * 		"NAME3": VALUE3
 * 	}
 *
 * @apiUse strongVerifyErrors
 * @apiError (CODE: DESC) {TYPE} ERROR1 DESC
 * @apiError (CODE: DESC) {TYPE} ERROR2 DESC
 * @apiError (CODE: DESC) {TYPE} ERROR3 DESC
 */
```


Below is an example for the auth roles endpoint, to be used as a general guideline:
```
/**
 * @api {get} /auth/roles/:USERID/ /auth/roles/:USERID/
 * @apiGroup Auth
 * @apiDescription Get the roles of a user, provided that there is a JWT token and the token contains VALID credentials for the operation.
 *
 * @apiParam {String} USERID Target user to get the roles of. Defaults to the user provided in the JWT token, if no user provided.
 *
 * @apiSuccess (200: Success) {String} id User ID.
 * @apiSuccess (200: Success) {String[]} roles Roles of the target user.
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"id": "provider0000001",
 * 		"roles": ["Admin", "Staff", "Mentor"]
 * 	}
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} UserNotFound User doesn't exist in the database.
 * @apiError (403: Forbidden) {String} Forbidden API accessed by user without valid perms.
 */
```

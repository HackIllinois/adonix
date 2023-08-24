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

```
/**
 * @api {<METHOD>} /<SERVICE>/<ENDPOINT>/ <Service Description>
 * @apiName <SERVICE>
 * @apiGroup <SUBSERVICE>
 * 
 * @apiBody {<TYPE>} <NAME> <DESC>
 * @apiParamExample {json} Example Request:
 * {<JSON BODY>}
 * 
 * @apiSuccess {<TYPE>} <NAME> <DESC>
 * @apiSuccessExample Example Success Response:
 *     HTTP/1.1 200 OK
 *     {<JSON BODY>}
 *
 * @apiError <ERROR NAME> <CODE>: <DESC>
 *
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 <EXAMPLE CODE> <EXAMPLE CODE MEANING>
 *     {"error": "<ERROR MESSAGE>"}
 */
```

# Adonix

Adonix is the HackIllinois backend API, built with TypeScript, Express, and MongoDB.

Use Yarn 1 (`yarn`, package manager version is pinned in `package.json`).

- `yarn build` compiles TypeScript.
- `yarn verify` runs type checking, lint, and formatting checks.
- `yarn test` runs Jest.

## API design

- Add endpoints with red–green–refactor: write a failing test for the expected behavior, implement the smallest change that passes, then refactor with tests green.
- Define routes with `specification()` so request validation, role authorization, and OpenAPI documentation share one contract. Declare request and response schemas and the least-privileged role.
- Test endpoint behavior through the router, including success, invalid input, authorization, and relevant database effects. Unit-test extracted domain logic for edge cases; assert observable behavior rather than implementation details.
- Define expected API errors with `CreateErrorAndSchema` from `src/common/schemas.ts` and include their schemas in `specification()` responses so runtime errors and OpenAPI docs stay aligned.
- Use `src/common/testTools.ts` for router tests. Jest provides an isolated `mongodb-memory-server` database through its setup files.
- Keep business logic reusable in service library modules and database models in service schemas. Follow neighboring services for naming and structure.

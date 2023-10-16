// Temporary solution to allow mocking of base url
// We should long term have a single file to define all ENV variables and allow that to be mocked instead

const username: string | undefined = process.env.DB_USERNAME;
const password: string | undefined = process.env.DB_PASSWORD;
const server: string | undefined = process.env.DB_SERVER;

export function getBaseURL(): string {
    return `mongodb+srv://${username}:${password}@${server}/`;
}

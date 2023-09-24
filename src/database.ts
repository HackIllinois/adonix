import "dotenv";
import { MongoClient } from "mongodb";

const username: string | undefined = process.env.DB_USERNAME;
const password: string | undefined = process.env.DB_PASSWORD;
const server: string | undefined = process.env.DB_SERVER;

const uri: string | undefined = `mongodb+srv://${username}:${password}@${server}/?retryWrites=true&w=majority`;

if (!uri) {
	throw new Error("No URI was able to be constructed or was provided in .env file! Please either set DB_URI or set DB_SERVER alongside DB_USERNAME and DB_PASSWORD if applicable.");
}

const client: MongoClient = new MongoClient(uri);

export default client;

import "dotenv";
import { MongoClient } from "mongodb";

const username: string | undefined = process.env.DB_USERNAME;
const password: string | undefined = process.env.DB_PASSWORD;
const server: string | undefined = process.env.DB_SERVER;

const credInfo: string = (username) ? `${encodeURIComponent(username)}:${encodeURIComponent(password || "")}@` : "";

const uri = process.env.DB_URI || (server) ? `mongodb+srv://${credInfo}${server}` : undefined;
if (!uri) {
	throw new Error("No URI was able to be constructed or was provided in .env file!");
}

const client = new MongoClient(uri, {
	retryWrites: true,
	w: "majority",
});

export default client;

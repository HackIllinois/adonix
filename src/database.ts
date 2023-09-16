import "dotenv";
import { MongoClient } from "mongodb";

const username: string | undefined = process.env.DB_USERNAME;
const password: string | undefined = process.env.DB_PASSWORD;
const server: string | undefined = process.env.DB_SERVER;

const credInfo: string = (username) ? `${encodeURIComponent(username)}:${encodeURIComponent(password || "")}@` : "";
if (!server) {
	throw new Error("server URI not provided in .env file!");
}

const uri = `mongodb+srv://${credInfo}${server}`;

const client = new MongoClient(uri, {
	retryWrites: true,
	w: "majority",
});

export default client;

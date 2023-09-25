import "dotenv";
import { MongoClient } from "mongodb";

const username: string | undefined = process.env.DB_USERNAME;
const password: string | undefined = process.env.DB_PASSWORD;
const server: string | undefined = process.env.DB_SERVER;

const uri: string = `mongodb+srv://${username}:${password}@${server}/?retryWrites=true&w=majority`;
const client: MongoClient = new MongoClient(uri);

export default client;

import "dotenv";
import { MongoClient, Collection, Db } from "mongodb";

//  TODO: Add in documentation

abstract class DatabaseHelper {
	private static databases: Map<string, Db> = new Map();

	static async getCollection(databaseName: string, collectionName: string): Promise<Collection> {
		const database: Db = this.databases?.get(databaseName) ?? await this.getDatabase(databaseName);
		const targetCollection: Collection = database.collection(collectionName);

		console.log(`Successfully connected to collection: ${targetCollection.collectionName}`);
		return targetCollection;
	}

	private static async getDatabase(databaseName: string): Promise<Db> {
		const connectionString: string = this.getConnectionString();

		const client: MongoClient = new MongoClient(connectionString);
		await client.connect().catch((error: Error) => {
			console.error(error);
		});
		
		const database: Db = client.db(databaseName);
		this.databases.set(databaseName, database);

		console.log(`Successfully connected to database: ${database.databaseName}`);
		return database;
	}

	private static getConnectionString():string {
		const user:string | undefined = process.env.DB_USERNAME;
		const pass:string | undefined = process.env.DB_PASSWORD;
		const server:string | undefined = process.env.DB_SERVER;

		if (!user || !pass || !server) {
			throw new Error("login values not provided in .env file!");
		}

		const connectionString:string = `mongodb+srv://${user}:${pass}@${server}/?retryWrites=true&w=majority`;
		return connectionString;
	}
}

export default DatabaseHelper;

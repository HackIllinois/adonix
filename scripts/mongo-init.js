db = db.getSiblingDB("adonix_dev");

db.createUser({
    user: "admin",
    pwd: "password",
    roles: [
        {
            role: "readWrite",
            db: "adonix_dev",
        },
    ],
});

const ATLAS_URI = process.env.ATLAS_PROD_URI;

if (!ATLAS_URI) {
    print("WARNING: an empty ATLAS_PROD_URI means the database will be empty");
    print("MongoDB development database initialized successfully!");
} else {
    print("Starting database import from Atlas production...");

    try {
        const atlasConn = new Mongo(ATLAS_URI);
        const atlasDb = atlasConn.getDB("main");

        const collectionsToImport = atlasDb.getCollectionNames();

        let totalDocuments = 0;
        let importedCollections = 0;

        collectionsToImport.forEach((collectionName) => {
            try {
                print(`Importing collection: ${collectionName}`);

                const sourceCollection = atlasDb.getCollection(collectionName);
                const documents = sourceCollection.find({}).toArray();

                if (documents.length > 0) {
                    const targetCollection = db.getCollection(collectionName);
                    targetCollection.insertMany(documents);

                    totalDocuments += documents.length;
                    importedCollections++;
                }
            } catch (collectionError) {
                print(`WARNING: Could not import ${collectionName}: ${collectionError.message}`);
            }
        });

        atlasConn.close();
    } catch (error) {
        print(`Error importing from Atlas: ${error.message}`);
        throw error;
    }
}

print("MongoDB development database initialized successfully!");

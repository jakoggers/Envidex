import { MongoClient } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

/**
 * Returns a connected MongoClient promise.
 * Throws only when a runtime caller needs the DB and MONGODB_URI_REAL is missing —
 * never invents a fake connection.
 */
export function getMongoClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI_REAL;
  if (!uri) {
    return Promise.reject(
      new Error("MONGODB_URI_REAL is not configured. Add it to your environment variables.")
    );
  }

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }

  return global._mongoClientPromise;
}

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI_REAL);
}

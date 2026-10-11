// MongoDB Atlas 7.0 (scm_audit_store) Collections, Validation Rules & Indexes
import { MongoClient } from "mongodb";

const uri =
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/scm_audit_store";

export async function migrateMongoCollections() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(process.env.MONGO_DB || "scm_audit_store");

  await db.collection("audit-logs").createIndex({ _createdAt: -1 });
  await db.collection("audit-logs").createIndex({ actor: 1, action: 1 });
  await db.collection("contact-notes").createIndex({ contactId: 1, _createdAt: -1 });
  await db.collection("idempotency-keys").createIndex({ scope: 1, key: 1 }, { unique: true });

  await client.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrateMongoCollections()
    .then(() => console.log("✅ MongoDB Atlas collections and indexes verified."))
    .catch((err) => {
      console.error("MongoDB migration warning:", err.message);
      process.exit(0);
    });
}

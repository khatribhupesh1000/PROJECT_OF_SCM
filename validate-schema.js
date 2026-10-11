import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, "contact-schema.json");
const contactSchema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validateContact = ajv.compile(contactSchema);

export function validateContactPayload(payload) {
  const valid = validateContact(payload);
  return {
    valid: Boolean(valid),
    errors: validateContact.errors || []
  };
}

// Run self-verification when executed directly via `node validate-schema.js`
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const sampleValid = {
    id: "cnt-1001",
    userId: "usr-1001",
    name: "Aarav Patel",
    email: "aarav.patel@scm.enterprise.io",
    phoneNumber: "+919876543210",
    address: "Bengaluru Tech Park, KA",
    description: "Principal Cloud Architect",
    favorite: true,
    websiteLink: "https://scm.enterprise.io",
    createdAt: "2026-10-10T12:00:00Z",
    updatedAt: "2026-10-10T12:00:00Z"
  };

  const sampleInvalid = {
    name: "A",
    email: "invalid-email",
    phoneNumber: "123"
  };

  const validRes = validateContactPayload(sampleValid);
  const invalidRes = validateContactPayload(sampleInvalid);

  if (!validRes.valid || invalidRes.valid) {
    console.error("Schema validation self-test failed!", { validRes, invalidRes });
    process.exit(1);
  }

  console.log("✅ Ajv Draft-07 Schema Validation passed for contact-schema.json");
}

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

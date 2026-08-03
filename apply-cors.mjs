/**
 * apply-cors.mjs
 * Applies CORS policy to Firebase Storage bucket so product images
 * can be fetched from any origin (including localhost).
 *
 * Usage:
 *   node apply-cors.mjs
 *
 * Requires Application Default Credentials (ADC):
 *   firebase login      — already done if you use Firebase CLI
 *   npx firebase-tools  — uses same credentials
 *
 * Or set GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service-account key.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { readFileSync } from "fs";
import { createRequire } from "module";

const BUCKET = "inventory-app-jey-123.firebasestorage.app";

const CORS_CONFIG = [
  {
    origin: ["*"],
    method: ["GET", "HEAD", "OPTIONS"],
    responseHeader: ["Content-Type", "Content-Length", "Content-Disposition"],
    maxAgeSeconds: 3600,
  },
];

// Initialize with ADC (Application Default Credentials)
if (!getApps().length) {
  initializeApp({ storageBucket: BUCKET });
}

const bucket = getStorage().bucket(BUCKET);

console.log(`Applying CORS to bucket: ${BUCKET} ...`);
try {
  await bucket.setCorsConfiguration(CORS_CONFIG);
  const [meta] = await bucket.getMetadata();
  console.log("✓ CORS aplicado correctamente:");
  console.log(JSON.stringify(meta.cors, null, 2));
} catch (err) {
  console.error("✗ Error:", err.message);
  console.error(
    "\nAsegúrate de estar logueado con: firebase login\n" +
      "O proporciona GOOGLE_APPLICATION_CREDENTIALS con una service account key.",
  );
  process.exit(1);
}

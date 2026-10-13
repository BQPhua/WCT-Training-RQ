/** Usage: npm run db:seed            (business units + departments)
 *         SEED_DEMO=true npm run db:seed (also demo users — dev/test only) */
import "dotenv/config";
import { seed } from "../src/db/seed";
import { closeDb } from "../src/db";

seed({ demo: process.env.SEED_DEMO === "true" })
  .then(async () => {
    console.log("Seed complete.");
    await closeDb();
  })
  .catch(async (err) => {
    console.error(err);
    await closeDb();
    process.exit(1);
  });

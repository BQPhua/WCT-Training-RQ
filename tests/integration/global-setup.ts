import { config } from "dotenv";
import { execSync } from "node:child_process";

export default function setup() {
  config({ path: ".env.test", override: true });
  execSync("npx tsx scripts/migrate.ts", { stdio: "inherit", env: process.env });
}

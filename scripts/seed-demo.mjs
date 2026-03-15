import process from "node:process";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed demo data in production.");
}

const { ensureSeedData } = await import("../src/server/services/bootstrap.ts");

await ensureSeedData();
process.stdout.write("Demo seed completed.\n");

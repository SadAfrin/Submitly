import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./prisma/db";

const email = "mentor@submitly.com";

await db.orm.public.User.upsert({
  create: {
    name: "Mentor",
    email,
    password: await bcrypt.hash("Mentor@123", 10),
    role: "MENTOR",
  },
  update: {},
  conflictOn: { email },
});

console.log("Mentor seeded:", email);
await db.close();
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function seedAdminUser(): Promise<void> {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    console.log("[Admin Seed] ADMIN_USERNAME or ADMIN_PASSWORD not set in environment. Skipping admin creation.");
    return;
  }

  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.username, adminUsername))
    .limit(1);

  if (existingAdmin.length > 0) {
    if (!existingAdmin[0].isAdmin) {
      await db
        .update(users)
        .set({ isAdmin: true })
        .where(eq(users.id, existingAdmin[0].id));
      console.log(`[Admin Seed] Updated existing user "${adminUsername}" to admin.`);
    } else {
      console.log(`[Admin Seed] Admin user "${adminUsername}" already exists.`);
    }
    return;
  }

  const hashedPassword = await hashPassword(adminPassword);
  
  await db.insert(users).values({
    username: adminUsername,
    password: hashedPassword,
    role: "owner",
    isAdmin: true,
    publicId: `ADM-${randomBytes(3).toString("hex").toUpperCase()}`,
  });

  console.log(`[Admin Seed] Created admin user "${adminUsername}".`);
}

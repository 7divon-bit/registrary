import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { fretes, InsertFrete, InsertPayment, InsertUser, payments, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── USERS ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod", "phone", "cidade"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };

  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (user.userType !== undefined) {
    values.userType = user.userType;
    updateSet.userType = user.userType;
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(
  userId: number,
  data: { userType?: "CLIENT" | "DRIVER"; phone?: string; cidade?: string; name?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

// ─── FRETES ───────────────────────────────────────────────────────────────────

export async function createFrete(data: InsertFrete) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(fretes).values(data);
  return result[0];
}

export async function getFretesByCity(cidade: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(fretes)
    .where(and(eq(fretes.status, "OPEN"), eq(fretes.cidade, cidade)))
    .orderBy(desc(fretes.createdAt));
}

export async function getFretesByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(fretes)
    .where(eq(fretes.clientId, clientId))
    .orderBy(desc(fretes.createdAt));
}

export async function getFretesByDriver(driverId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(fretes)
    .where(eq(fretes.driverId, driverId))
    .orderBy(desc(fretes.createdAt));
}

export async function getFreteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(fretes).where(eq(fretes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function acceptFrete(freteId: number, driverId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db
    .update(fretes)
    .set({ status: "ASSIGNED", driverId })
    .where(and(eq(fretes.id, freteId), eq(fretes.status, "OPEN")));
  return (result[0] as { affectedRows: number }).affectedRows > 0;
}

export async function completeFrete(freteId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(fretes).set({ status: "DELIVERED" }).where(eq(fretes.id, freteId));
}

export async function getAllFretes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fretes).orderBy(desc(fretes.createdAt));
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

export async function createPayment(data: InsertPayment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(payments).values(data);
  return result[0];
}

export async function getPaymentByFreteId(freteId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(payments).where(eq(payments.freteId, freteId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updatePaymentStatus(
  paymentId: number,
  status: "PENDING" | "PAID" | "FAILED",
  mpPaymentId?: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(payments)
    .set({ status, ...(mpPaymentId ? { mpPaymentId } : {}) })
    .where(eq(payments.id, paymentId));
}

export async function getAllPayments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).orderBy(desc(payments.createdAt));
}

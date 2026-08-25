import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { toPublicUser } from '../lib/publicUser.js';
import type { UpdateUserInput } from '../schemas/user.schema.js';

export async function getUserById(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  return toPublicUser(user);
}

export async function updateUserById(id: number, input: UpdateUserInput) {
  const [user] = await db.update(users).set(input).where(eq(users.id, id)).returning();
  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  return toPublicUser(user);
}

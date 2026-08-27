import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { insertReturning } from '../db/returning.js';
import { stores, users } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { refreshTokenTtlMs, signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { toPublicUser } from '../lib/publicUser.js';
import type { LoginInput, SignupInput } from '../schemas/auth.schema.js';

const SALT_ROUNDS = 12;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function issueTokenPair(userId: number) {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  await db
    .update(users)
    .set({ refreshTokenHash: hashToken(refreshToken), refreshTokenExpiresAt: new Date(Date.now() + refreshTokenTtlMs()) })
    .where(eq(users.id, userId));
  return { accessToken, refreshToken };
}

export async function signup(input: SignupInput) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing) throw new ApiError(409, 'An account with this email already exists', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await insertReturning(users, {
    fullName: input.fullName,
    email: input.email,
    passwordHash,
    jobTitle: input.jobTitle,
  });
  if (!user) throw new ApiError(500, 'Unable to create account', 'SIGNUP_FAILED');

  // A brand-new account has no shop connected yet. This placeholder row keeps every service
  // that resolves "the user's store" working from the moment of signup, and platform
  // 'Not connected' is exactly what resolveStoreForInstall() looks for: the first Shopify
  // install CLAIMS this row and overwrites its identity, rather than creating a second store.
  // Nothing here is presented as real store data — no audit can run until a shop is connected.
  await db.insert(stores).values({
    ownerId: user.id,
    workspaceName: `${input.fullName}'s workspace`,
    name: 'My store',
    url: 'https://example.com',
    platform: 'Not connected',
    industry: 'Unspecified',
    country: 'Unspecified',
    timezone: '(UTC+00:00) UTC',
    currency: 'USD — US Dollar',
  });

  const tokens = await issueTokenPair(user.id);
  return { user: toPublicUser(user), ...tokens };
}

export async function login(input: LoginInput) {
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (!user) throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');

  const tokens = await issueTokenPair(user.id);
  return { user: toPublicUser(user), ...tokens };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user || !user.refreshTokenHash || !user.refreshTokenExpiresAt) {
    throw new ApiError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }
  // Reject reuse of a rotated-out token and any token issued before the last logout.
  if (user.refreshTokenHash !== hashToken(refreshToken) || user.refreshTokenExpiresAt < new Date()) {
    throw new ApiError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  return issueTokenPair(user.id);
}

export async function logout(userId: number) {
  await db.update(users).set({ refreshTokenHash: null, refreshTokenExpiresAt: null }).where(eq(users.id, userId));
}

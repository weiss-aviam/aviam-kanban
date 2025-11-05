import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";

/**
 * Sync user profile from Supabase Auth to our database
 * This should be called after successful authentication
 */
export async function syncUserProfile(authUser: User): Promise<void> {
  try {
    // Check if user already exists in our database
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (existingUser.length > 0) {
      // User exists, update their profile if needed
      const user = existingUser[0]!;
      const needsUpdate =
        user.email !== authUser.email ||
        user.name !==
          (authUser.user_metadata?.name || authUser.user_metadata?.full_name);

      if (needsUpdate) {
        await db
          .update(users)
          .set({
            email: authUser.email!,
            name:
              authUser.user_metadata?.name ||
              authUser.user_metadata?.full_name ||
              null,
          })
          .where(eq(users.id, authUser.id));

        console.log(`Updated profile for user: ${authUser.email}`);
      }
    } else {
      // User doesn't exist, create new profile
      await db.insert(users).values({
        id: authUser.id,
        email: authUser.email!,
        name:
          authUser.user_metadata?.name ||
          authUser.user_metadata?.full_name ||
          null,
      });

      console.log(`Created new profile for user: ${authUser.email}`);
    }
  } catch (error) {
    console.error("Error syncing user profile:", error);
    throw error;
  }
}

/**
 * Get user profile from our database
 */
export async function getUserProfile(userId: string) {
  try {
    const userProfile = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return userProfile[0] || null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

/**
 * Update user profile in our database
 */
export async function updateUserProfile(
  userId: string,
  updates: { name?: string; email?: string },
) {
  try {
    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    return updatedUser;
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
}

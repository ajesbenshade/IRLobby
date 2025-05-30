import { 
  users, 
  activities,
  activitySwipes,
  activityMatches,
  chatRooms,
  chatMessages,
  userRatings,
  type User, 
  type UpsertUser,
  type Activity,
  type InsertActivity,
  type InsertActivitySwipe,
  type ActivitySwipe,
  type InsertActivityMatch,
  type ActivityMatch,
  type InsertChatMessage,
  type ChatMessage,
  type InsertUserRating,
  type UserRating,
  type ChatRoom
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, ne, sql, not, inArray } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  updateUserRatingStats(userId: string): Promise<void>;
  
  // Activity operations
  createActivity(activity: InsertActivity): Promise<Activity>;
  getActivity(id: number): Promise<Activity | undefined>;
  getActivityWithDetails(id: number): Promise<Activity | undefined>;
  getDiscoverableActivities(userId: string, filters: any): Promise<Activity[]>;
  updateActivity(id: number, data: Partial<Activity>): Promise<Activity>;
  
  // Swipe operations
  createActivitySwipe(swipe: InsertActivitySwipe): Promise<ActivitySwipe>;
  
  // Match operations
  createActivityMatch(match: InsertActivityMatch): Promise<ActivityMatch>;
  updateActivityMatch(id: number, data: Partial<ActivityMatch>): Promise<ActivityMatch>;
  getUserMatches(userId: string): Promise<any[]>;
  isUserParticipant(userId: string, activityId: number): Promise<boolean>;
  
  // Chat operations
  getOrCreateChatRoom(activityId: number): Promise<ChatRoom>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(activityId: number): Promise<any[]>;
  getChatMessageWithSender(messageId: number): Promise<any>;
  
  // Rating operations
  createUserRating(rating: InsertUserRating): Promise<UserRating>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserRatingStats(userId: string): Promise<void> {
    const ratings = await db
      .select()
      .from(userRatings)
      .where(eq(userRatings.ratedUserId, userId));
    
    if (ratings.length > 0) {
      const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      await db
        .update(users)
        .set({ 
          rating: avgRating, 
          totalRatings: ratings.length,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
    }
  }

  // Activity operations
  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db
      .insert(activities)
      .values(activity)
      .returning();
    return newActivity;
  }

  async getActivity(id: number): Promise<Activity | undefined> {
    const [activity] = await db
      .select()
      .from(activities)
      .where(eq(activities.id, id));
    return activity;
  }

  async getActivityWithDetails(id: number): Promise<Activity | undefined> {
    const [activity] = await db
      .select()
      .from(activities)
      .where(eq(activities.id, id));
    return activity;
  }

  async getDiscoverableActivities(userId: string, filters: any): Promise<Activity[]> {
    const { limit = 20 } = filters;
    
    // Get activities that the user hasn't swiped on yet
    const swipedActivityIds = await db
      .select({ activityId: activitySwipes.activityId })
      .from(activitySwipes)
      .where(eq(activitySwipes.userId, userId));
    
    const swipedIds = swipedActivityIds.map(s => s.activityId);
    
    if (swipedIds.length > 0) {
      return await db
        .select()
        .from(activities)
        .where(
          and(
            ne(activities.hostId, userId),
            eq(activities.status, 'active'),
            sql`${activities.dateTime} > NOW()`,
            not(inArray(activities.id, swipedIds))
          )
        )
        .orderBy(desc(activities.createdAt))
        .limit(limit);
    } else {
      return await db
        .select()
        .from(activities)
        .where(
          and(
            ne(activities.hostId, userId),
            eq(activities.status, 'active'),
            sql`${activities.dateTime} > NOW()`
          )
        )
        .orderBy(desc(activities.createdAt))
        .limit(limit);
    }
  }

  async updateActivity(id: number, data: Partial<Activity>): Promise<Activity> {
    const [activity] = await db
      .update(activities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(activities.id, id))
      .returning();
    return activity;
  }

  // Swipe operations
  async createActivitySwipe(swipe: InsertActivitySwipe): Promise<ActivitySwipe> {
    const [newSwipe] = await db
      .insert(activitySwipes)
      .values(swipe)
      .returning();
    return newSwipe;
  }

  // Match operations
  async createActivityMatch(match: InsertActivityMatch): Promise<ActivityMatch> {
    const [newMatch] = await db
      .insert(activityMatches)
      .values(match)
      .returning();
    return newMatch;
  }

  async updateActivityMatch(id: number, data: Partial<ActivityMatch>): Promise<ActivityMatch> {
    const [match] = await db
      .update(activityMatches)
      .set(data)
      .where(eq(activityMatches.id, id))
      .returning();
    return match;
  }

  async getUserMatches(userId: string): Promise<any[]> {
    const matches = await db
      .select({
        id: activityMatches.id,
        status: activityMatches.status,
        joinedAt: activityMatches.joinedAt,
        activity: {
          id: activities.id,
          title: activities.title,
          dateTime: activities.dateTime,
          location: activities.location,
          imageUrl: activities.imageUrl,
        }
      })
      .from(activityMatches)
      .innerJoin(activities, eq(activityMatches.activityId, activities.id))
      .where(eq(activityMatches.userId, userId))
      .orderBy(desc(activityMatches.createdAt));
    
    return matches;
  }

  async isUserParticipant(userId: string, activityId: number): Promise<boolean> {
    // Check if user is host or participant
    const activity = await this.getActivity(activityId);
    if (activity?.hostId === userId) return true;
    
    const [match] = await db
      .select()
      .from(activityMatches)
      .where(
        and(
          eq(activityMatches.userId, userId),
          eq(activityMatches.activityId, activityId),
          eq(activityMatches.status, 'approved')
        )
      );
    
    return !!match;
  }

  // Chat operations
  async getOrCreateChatRoom(activityId: number): Promise<ChatRoom> {
    const [existingRoom] = await db
      .select()
      .from(chatRooms)
      .where(eq(chatRooms.activityId, activityId));
    
    if (existingRoom) return existingRoom;
    
    const [newRoom] = await db
      .insert(chatRooms)
      .values({ activityId })
      .returning();
    
    return newRoom;
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db
      .insert(chatMessages)
      .values(message)
      .returning();
    return newMessage;
  }

  async getChatMessages(activityId: number): Promise<any[]> {
    const chatRoom = await this.getOrCreateChatRoom(activityId);
    
    const messages = await db
      .select({
        id: chatMessages.id,
        message: chatMessages.message,
        messageType: chatMessages.messageType,
        createdAt: chatMessages.createdAt,
        senderId: chatMessages.senderId,
        sender: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
        }
      })
      .from(chatMessages)
      .innerJoin(users, eq(chatMessages.senderId, users.id))
      .where(eq(chatMessages.chatRoomId, chatRoom.id))
      .orderBy(chatMessages.createdAt);
    
    return messages;
  }

  async getChatMessageWithSender(messageId: number): Promise<any> {
    const [message] = await db
      .select({
        id: chatMessages.id,
        message: chatMessages.message,
        messageType: chatMessages.messageType,
        createdAt: chatMessages.createdAt,
        senderId: chatMessages.senderId,
        sender: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
        }
      })
      .from(chatMessages)
      .innerJoin(users, eq(chatMessages.senderId, users.id))
      .where(eq(chatMessages.id, messageId));
    
    return message;
  }

  // Rating operations
  async createUserRating(rating: InsertUserRating): Promise<UserRating> {
    const [newRating] = await db
      .insert(userRatings)
      .values(rating)
      .returning();
    return newRating;
  }
}

export const storage = new DatabaseStorage();
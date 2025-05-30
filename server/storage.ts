import { 
  users, 
  activities,
  activitySwipes,
  activityMatches,
  activityApplications,
  chatRooms,
  chatMessages,
  userRatings,
  userFriends,
  type User, 
  type UpsertUser,
  type Activity,
  type InsertActivity,
  type InsertActivitySwipe,
  type ActivitySwipe,
  type InsertActivityMatch,
  type ActivityMatch,
  type InsertActivityApplication,
  type ActivityApplication,
  type InsertChatMessage,
  type ChatMessage,
  type InsertUserRating,
  type UserRating,
  type InsertUserFriend,
  type UserFriend,
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
  
  // Application operations for private events
  createActivityApplication(application: InsertActivityApplication): Promise<ActivityApplication>;
  updateActivityApplication(id: number, data: Partial<ActivityApplication>): Promise<ActivityApplication>;
  getActivityApplications(activityId: number): Promise<any[]>;
  getHostApplications(hostId: string): Promise<any[]>;
  getUserApplications(userId: string): Promise<any[]>;
  
  // Location-based operations
  getNearbyActivities(userId: string, latitude: number, longitude: number, maxDistance: number, filters: any): Promise<Activity[]>;
  
  // Chat operations
  getOrCreateChatRoom(activityId: number): Promise<ChatRoom>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(activityId: number): Promise<any[]>;
  getChatMessageWithSender(messageId: number): Promise<any>;
  
  // Rating operations
  createUserRating(rating: InsertUserRating): Promise<UserRating>;
  
  // Friend operations
  sendFriendRequest(requesterId: string, receiverId: string): Promise<UserFriend>;
  acceptFriendRequest(friendshipId: number): Promise<UserFriend>;
  rejectFriendRequest(friendshipId: number): Promise<UserFriend>;
  getUserFriends(userId: string): Promise<any[]>;
  getUserFriendRequests(userId: string): Promise<any[]>;
  areFriends(userId1: string, userId2: string): Promise<boolean>;
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

  // Application operations for private events
  async createActivityApplication(application: InsertActivityApplication): Promise<ActivityApplication> {
    const [newApplication] = await db
      .insert(activityApplications)
      .values(application)
      .returning();
    return newApplication;
  }

  async updateActivityApplication(id: number, data: Partial<ActivityApplication>): Promise<ActivityApplication> {
    const [updatedApplication] = await db
      .update(activityApplications)
      .set({ ...data, reviewedAt: new Date() })
      .where(eq(activityApplications.id, id))
      .returning();
    return updatedApplication;
  }

  async getActivityApplications(activityId: number): Promise<any[]> {
    return await db
      .select({
        id: activityApplications.id,
        status: activityApplications.status,
        message: activityApplications.message,
        hostMessage: activityApplications.hostMessage,
        appliedAt: activityApplications.appliedAt,
        reviewedAt: activityApplications.reviewedAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          email: users.email,
        }
      })
      .from(activityApplications)
      .leftJoin(users, eq(activityApplications.userId, users.id))
      .where(eq(activityApplications.activityId, activityId))
      .orderBy(desc(activityApplications.appliedAt));
  }

  async getHostApplications(hostId: string): Promise<any[]> {
    return await db
      .select({
        id: activityApplications.id,
        status: activityApplications.status,
        message: activityApplications.message,
        appliedAt: activityApplications.appliedAt,
        activity: {
          id: activities.id,
          title: activities.title,
          dateTime: activities.dateTime,
          location: activities.location,
        },
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        }
      })
      .from(activityApplications)
      .leftJoin(activities, eq(activityApplications.activityId, activities.id))
      .leftJoin(users, eq(activityApplications.userId, users.id))
      .where(and(
        eq(activityApplications.hostId, hostId),
        eq(activityApplications.status, 'pending')
      ))
      .orderBy(desc(activityApplications.appliedAt));
  }

  async getUserApplications(userId: string): Promise<any[]> {
    return await db
      .select({
        id: activityApplications.id,
        status: activityApplications.status,
        message: activityApplications.message,
        hostMessage: activityApplications.hostMessage,
        appliedAt: activityApplications.appliedAt,
        reviewedAt: activityApplications.reviewedAt,
        activity: {
          id: activities.id,
          title: activities.title,
          dateTime: activities.dateTime,
          location: activities.location,
          isPrivate: activities.isPrivate,
        }
      })
      .from(activityApplications)
      .leftJoin(activities, eq(activityApplications.activityId, activities.id))
      .where(eq(activityApplications.userId, userId))
      .orderBy(desc(activityApplications.appliedAt));
  }

  // Location-based operations
  async getNearbyActivities(userId: string, latitude: number, longitude: number, maxDistance: number = 25, filters: any = {}): Promise<Activity[]> {
    // Get activities the user has already swiped on
    const swipedActivityIds = await db
      .select({ activityId: activitySwipes.activityId })
      .from(activitySwipes)
      .where(eq(activitySwipes.userId, userId));
    
    const swipedIds = swipedActivityIds.map(s => s.activityId);

    let baseConditions = [
      ne(activities.hostId, userId),
      eq(activities.status, 'active'),
      sql`${activities.dateTime} > NOW()`,
      sql`${activities.latitude} IS NOT NULL`,
      sql`${activities.longitude} IS NOT NULL`
    ];

    if (swipedIds.length > 0) {
      baseConditions.push(not(inArray(activities.id, swipedIds)));
    }

    // Apply filters
    if (filters.category && filters.category !== "All Categories") {
      baseConditions.push(eq(activities.category, filters.category));
    }

    if (filters.priceRange && filters.priceRange.length === 2) {
      baseConditions.push(
        sql`${activities.price} >= ${filters.priceRange[0]} AND ${activities.price} <= ${filters.priceRange[1]}`
      );
    }

    // Distance calculation using Haversine formula
    const distanceFormula = sql`(
      3959 * acos(
        cos(radians(${latitude})) * 
        cos(radians(${activities.latitude})) * 
        cos(radians(${activities.longitude}) - radians(${longitude})) + 
        sin(radians(${latitude})) * 
        sin(radians(${activities.latitude}))
      )
    )`;

    baseConditions.push(sql`${distanceFormula} <= ${maxDistance}`);

    return await db
      .select()
      .from(activities)
      .where(and(...baseConditions))
      .orderBy(distanceFormula)
      .limit(50);
  }

  // Friend operations
  async sendFriendRequest(requesterId: string, receiverId: string): Promise<UserFriend> {
    const [friendship] = await db
      .insert(userFriends)
      .values({
        requesterId,
        receiverId,
        status: 'pending'
      })
      .returning();
    return friendship;
  }

  async acceptFriendRequest(friendshipId: number): Promise<UserFriend> {
    const [friendship] = await db
      .update(userFriends)
      .set({ 
        status: 'accepted',
        updatedAt: new Date()
      })
      .where(eq(userFriends.id, friendshipId))
      .returning();
    return friendship;
  }

  async rejectFriendRequest(friendshipId: number): Promise<UserFriend> {
    const [friendship] = await db
      .update(userFriends)
      .set({ 
        status: 'rejected',
        updatedAt: new Date()
      })
      .where(eq(userFriends.id, friendshipId))
      .returning();
    return friendship;
  }

  async getUserFriends(userId: string): Promise<any[]> {
    return await db
      .select({
        id: userFriends.id,
        friendId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        email: users.email,
        status: userFriends.status,
        createdAt: userFriends.createdAt
      })
      .from(userFriends)
      .leftJoin(users, eq(userFriends.receiverId, users.id))
      .where(and(
        eq(userFriends.requesterId, userId),
        eq(userFriends.status, 'accepted')
      ))
      .union(
        db.select({
          id: userFriends.id,
          friendId: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          email: users.email,
          status: userFriends.status,
          createdAt: userFriends.createdAt
        })
        .from(userFriends)
        .leftJoin(users, eq(userFriends.requesterId, users.id))
        .where(and(
          eq(userFriends.receiverId, userId),
          eq(userFriends.status, 'accepted')
        ))
      );
  }

  async getUserFriendRequests(userId: string): Promise<any[]> {
    return await db
      .select({
        id: userFriends.id,
        requesterId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        email: users.email,
        status: userFriends.status,
        createdAt: userFriends.createdAt
      })
      .from(userFriends)
      .leftJoin(users, eq(userFriends.requesterId, users.id))
      .where(and(
        eq(userFriends.receiverId, userId),
        eq(userFriends.status, 'pending')
      ))
      .orderBy(desc(userFriends.createdAt));
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await db
      .select()
      .from(userFriends)
      .where(and(
        eq(userFriends.status, 'accepted'),
        sql`(${userFriends.requesterId} = ${userId1} AND ${userFriends.receiverId} = ${userId2}) OR (${userFriends.requesterId} = ${userId2} AND ${userFriends.receiverId} = ${userId1})`
      ))
      .limit(1);
    return friendship.length > 0;
  }
}

export const storage = new DatabaseStorage();
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  bio: text("bio"),
  interests: jsonb("interests").$type<string[]>().default([]),
  location: varchar("location"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  rating: real("rating").default(5.0),
  totalRatings: integer("total_ratings").default(0),
  eventsHosted: integer("events_hosted").default(0),
  eventsAttended: integer("events_attended").default(0),
  isVerified: boolean("is_verified").default(false),
  verificationLevel: varchar("verification_level").default("none"), // none, email, phone, id
  pushNotifications: boolean("push_notifications").default(true),
  emailNotifications: boolean("email_notifications").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  hostId: varchar("host_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar("title").notNull(),
  description: text("description"),
  category: varchar("category").notNull(),
  location: varchar("location").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  dateTime: timestamp("date_time").notNull(),
  endDateTime: timestamp("end_date_time"),
  maxParticipants: integer("max_participants").notNull(),
  currentParticipants: integer("current_participants").default(0),
  waitlistCount: integer("waitlist_count").default(0),
  isPrivate: boolean("is_private").default(false),
  tags: jsonb("tags").$type<string[]>().default([]),
  imageUrl: varchar("image_url"),
  imageUrls: jsonb("image_urls").$type<string[]>().default([]),
  price: real("price").default(0),
  currency: varchar("currency").default("USD"),
  requiresApproval: boolean("requires_approval").default(false),
  ageRestriction: varchar("age_restriction"), // 18+, 21+, all_ages
  skillLevel: varchar("skill_level"), // beginner, intermediate, advanced, all_levels
  equipmentProvided: boolean("equipment_provided").default(false),
  equipmentRequired: text("equipment_required"),
  weatherDependent: boolean("weather_dependent").default(false),
  status: varchar("status").default("active"), // active, cancelled, completed, full
  cancellationReason: text("cancellation_reason"),
  recurringPattern: varchar("recurring_pattern"), // weekly, monthly, none
  reminderSent: boolean("reminder_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const activitySwipes = pgTable("activity_swipes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  activityId: integer("activity_id").notNull().references(() => activities.id, { onDelete: 'cascade' }),
  swipeType: varchar("swipe_type").notNull(), // 'like', 'pass'
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityMatches = pgTable("activity_matches", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  activityId: integer("activity_id").notNull().references(() => activities.id, { onDelete: 'cascade' }),
  status: varchar("status").default("pending"), // pending, approved, rejected
  joinedAt: timestamp("joined_at"),
  leftAt: timestamp("left_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityApplications = pgTable("activity_applications", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => activities.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  hostId: varchar("host_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar("status").default("pending"), // pending, approved, rejected
  message: text("message"), // Optional message from applicant
  hostMessage: text("host_message"), // Optional message from host
  appliedAt: timestamp("applied_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const chatRooms = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => activities.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  chatRoomId: integer("chat_room_id").notNull().references(() => chatRooms.id, { onDelete: 'cascade' }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text("message").notNull(),
  messageType: varchar("message_type").default("text"), // text, image, system
  createdAt: timestamp("created_at").defaultNow(),
});

export const userRatings = pgTable("user_ratings", {
  id: serial("id").primaryKey(),
  raterId: varchar("rater_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  ratedUserId: varchar("rated_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  activityId: integer("activity_id").notNull().references(() => activities.id, { onDelete: 'cascade' }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityReviews = pgTable("activity_reviews", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => activities.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: integer("rating").notNull(),
  review: text("review"),
  photos: jsonb("photos").$type<string[]>().default([]),
  helpful: integer("helpful").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userFriends = pgTable("user_friends", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  friendId: varchar("friend_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar("status").default("pending"), // pending, accepted, blocked
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityWaitlist = pgTable("activity_waitlist", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => activities.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  position: integer("position").notNull(),
  notified: boolean("notified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar("type").notNull(), // match, message, activity_update, reminder, waitlist
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityTemplates = pgTable("activity_templates", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  tags: jsonb("tags").$type<string[]>().default([]),
  defaultDuration: integer("default_duration"), // minutes
  defaultMaxParticipants: integer("default_max_participants"),
  isPublic: boolean("is_public").default(false),
  useCount: integer("use_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  hostedActivities: many(activities),
  swipes: many(activitySwipes),
  matches: many(activityMatches),
  sentMessages: many(chatMessages),
  givenRatings: many(userRatings, { relationName: "rater" }),
  receivedRatings: many(userRatings, { relationName: "rated" }),
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  host: one(users, {
    fields: [activities.hostId],
    references: [users.id],
  }),
  swipes: many(activitySwipes),
  matches: many(activityMatches),
  chatRoom: one(chatRooms),
  ratings: many(userRatings),
}));

export const activitySwipesRelations = relations(activitySwipes, ({ one }) => ({
  user: one(users, {
    fields: [activitySwipes.userId],
    references: [users.id],
  }),
  activity: one(activities, {
    fields: [activitySwipes.activityId],
    references: [activities.id],
  }),
}));

export const activityMatchesRelations = relations(activityMatches, ({ one }) => ({
  user: one(users, {
    fields: [activityMatches.userId],
    references: [users.id],
  }),
  activity: one(activities, {
    fields: [activityMatches.activityId],
    references: [activities.id],
  }),
}));

export const chatRoomsRelations = relations(chatRooms, ({ one, many }) => ({
  activity: one(activities, {
    fields: [chatRooms.activityId],
    references: [activities.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  chatRoom: one(chatRooms, {
    fields: [chatMessages.chatRoomId],
    references: [chatRooms.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
}));

export const userRatingsRelations = relations(userRatings, ({ one }) => ({
  rater: one(users, {
    fields: [userRatings.raterId],
    references: [users.id],
    relationName: "rater",
  }),
  ratedUser: one(users, {
    fields: [userRatings.ratedUserId],
    references: [users.id],
    relationName: "rated",
  }),
  activity: one(activities, {
    fields: [userRatings.activityId],
    references: [activities.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  currentParticipants: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySwipeSchema = createInsertSchema(activitySwipes).omit({
  id: true,
  createdAt: true,
});

export const insertActivityMatchSchema = createInsertSchema(activityMatches).omit({
  id: true,
  createdAt: true,
});

export const insertActivityApplicationSchema = createInsertSchema(activityApplications).omit({
  id: true,
  appliedAt: true,
  reviewedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertUserRatingSchema = createInsertSchema(userRatings).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivitySwipe = z.infer<typeof insertActivitySwipeSchema>;
export type ActivitySwipe = typeof activitySwipes.$inferSelect;
export type InsertActivityMatch = z.infer<typeof insertActivityMatchSchema>;
export type ActivityMatch = typeof activityMatches.$inferSelect;
export type InsertActivityApplication = z.infer<typeof insertActivityApplicationSchema>;
export type ActivityApplication = typeof activityApplications.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertUserRating = z.infer<typeof insertUserRatingSchema>;
export type UserRating = typeof userRatings.$inferSelect;
export type ChatRoom = typeof chatRooms.$inferSelect;

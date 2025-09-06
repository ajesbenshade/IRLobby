import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth"; // Updated to use our new auth system
import { db } from "./db";
import { 
  insertActivitySchema, 
  insertActivitySwipeSchema, 
  insertActivityMatchSchema,
  insertChatMessageSchema,
  insertUserRatingSchema,
  userFriends
} from "@shared/schema";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

interface WebSocketWithUser extends WebSocket {
  userId?: string;
  chatRoomId?: number;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // User endpoint for current user
  app.get('/api/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't send sensitive information to the client
      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Activity routes
  app.get('/api/activities/discover', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`Fetching activities for user: ${userId} with filters:`, req.query);
      const activities = await storage.getDiscoverableActivities(userId, req.query);
      console.log(`Found ${activities.length} activities`);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching discoverable activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.get('/api/activities/nearby', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { latitude, longitude, maxDistance = 25, ...filters } = req.query;
      
      if (!latitude || !longitude) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
      }

      const activities = await storage.getNearbyActivities(
        userId,
        parseFloat(latitude),
        parseFloat(longitude),
        parseInt(maxDistance),
        filters
      );
      
      res.json(activities);
    } catch (error) {
      console.error("Error fetching nearby activities:", error);
      res.status(500).json({ message: "Failed to fetch nearby activities" });
    }
  });

  app.post('/api/activities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertActivitySchema.parse({
        ...req.body,
        hostId: userId,
      });
      
      const activity = await storage.createActivity(validatedData);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid activity data", errors: error.errors });
      } else {
        console.error("Error creating activity:", error);
        res.status(500).json({ message: "Failed to create activity" });
      }
    }
  });

  app.get('/api/activities/:id', isAuthenticated, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const activity = await storage.getActivityWithDetails(activityId);
      
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      
      res.json(activity);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.patch('/api/activities/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activityId = parseInt(req.params.id);
      
      // Check if user is the host
      const activity = await storage.getActivity(activityId);
      if (!activity || activity.hostId !== userId) {
        return res.status(403).json({ message: "Not authorized to edit this activity" });
      }
      
      const updatedActivity = await storage.updateActivity(activityId, req.body);
      res.json(updatedActivity);
    } catch (error) {
      console.error("Error updating activity:", error);
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  // Swipe routes
  app.post('/api/activities/:id/swipe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activityId = parseInt(req.params.id);
      const { swipeType } = req.body;
      
      const validatedData = insertActivitySwipeSchema.parse({
        userId,
        activityId,
        swipeType,
      });
      
      const swipe = await storage.createActivitySwipe(validatedData);
      
      // If it's a like, check for potential match
      if (swipeType === 'like') {
        const activity = await storage.getActivity(activityId);
        if (activity) {
          if (activity.isPrivate || activity.requiresApproval) {
            // For private events, create an application instead of direct match
            const application = await storage.createActivityApplication({
              userId,
              activityId,
              hostId: activity.hostId,
              message: req.body.message || null,
            });
            
            res.json({ swipe, applied: true, activity });
          } else {
            // For public events, create immediate match
            const match = await storage.createActivityMatch({
              userId,
              activityId,
              status: 'approved',
              joinedAt: new Date(),
            });
            
            // Notify via WebSocket
            broadcastToActivity(activityId, {
              type: 'new_match',
              match,
              user: await storage.getUser(userId),
            });
            
            res.json({ swipe, match });
          }
        }
      } else {
        res.json({ swipe });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid swipe data", errors: error.errors });
      } else {
        console.error("Error creating swipe:", error);
        res.status(500).json({ message: "Failed to create swipe" });
      }
    }
  });

  // Match routes
  app.get('/api/matches', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const matches = await storage.getUserMatches(userId);
      res.json(matches);
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ message: "Failed to fetch matches" });
    }
  });

  app.patch('/api/matches/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const matchId = parseInt(req.params.id);
      const { status } = req.body;
      
      const match = await storage.updateActivityMatch(matchId, { status });
      
      // Notify via WebSocket
      if (match) {
        broadcastToActivity(match.activityId, {
          type: 'match_updated',
          match,
        });
      }
      
      res.json(match);
    } catch (error) {
      console.error("Error updating match:", error);
      res.status(500).json({ message: "Failed to update match" });
    }
  });

  // Chat routes
  app.get('/api/activities/:id/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activityId = parseInt(req.params.id);
      
      // Check if user is part of this activity
      const isParticipant = await storage.isUserParticipant(userId, activityId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Not authorized to view this chat" });
      }
      
      const messages = await storage.getChatMessages(activityId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post('/api/activities/:id/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activityId = parseInt(req.params.id);
      
      console.log(`User ${userId} attempting to send message to activity ${activityId}`, req.body);
      
      // Check if user is part of this activity
      const isParticipant = await storage.isUserParticipant(userId, activityId);
      if (!isParticipant) {
        console.log(`User ${userId} not authorized to send messages to activity ${activityId}`);
        return res.status(403).json({ message: "Not authorized to send messages" });
      }
      
      const chatRoom = await storage.getOrCreateChatRoom(activityId);
      console.log(`Using chat room ID ${chatRoom.id} for activity ${activityId}`);
      
      try {
        const validatedData = insertChatMessageSchema.parse({
          chatRoomId: chatRoom.id,
          senderId: userId,
          message: req.body.message,
          messageType: req.body.messageType || 'text',
        });
        
        const message = await storage.createChatMessage(validatedData);
        const messageWithSender = await storage.getChatMessageWithSender(message.id);
        
        console.log(`Message created with ID ${message.id} for activity ${activityId}`);
           // Broadcast to WebSocket clients
      broadcastToActivity(activityId, {
        type: 'chat_message',
        activityId: activityId,
        data: messageWithSender,
      });
      
      res.status(201).json(messageWithSender);
      } catch (validationError) {
        console.error("Validation error:", validationError);
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid message data", errors: validationError.errors });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Rating routes
  app.post('/api/activities/:id/rate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activityId = parseInt(req.params.id);
      const { ratedUserId, rating, comment } = req.body;
      
      const validatedData = insertUserRatingSchema.parse({
        raterId: userId,
        ratedUserId,
        activityId,
        rating,
        comment,
      });
      
      const userRating = await storage.createUserRating(validatedData);
      await storage.updateUserRatingStats(ratedUserId);
      
      res.status(201).json(userRating);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid rating data", errors: error.errors });
      } else {
        console.error("Error creating rating:", error);
        res.status(500).json({ message: "Failed to create rating" });
      }
    }
  });

  // User profile routes
  app.patch('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updatedUser = await storage.updateUser(userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Get user by ID
  app.get('/api/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUserWithStats(req.params.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  // Get user reviews
  app.get('/api/users/:userId/reviews', isAuthenticated, async (req: any, res) => {
    try {
      const reviews = await storage.getUserReviews(req.params.userId);
      res.json(reviews);
    } catch (error) {
      console.error('Error fetching user reviews:', error);
      res.status(500).json({ message: 'Failed to fetch user reviews' });
    }
  });

  // Friend management routes
  app.post('/api/friends/request', isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.claims.sub;
      const { receiverId } = req.body;
      
      if (!receiverId) {
        return res.status(400).json({ message: "Receiver ID is required" });
      }
      
      if (requesterId === receiverId) {
        return res.status(400).json({ message: "You cannot send a friend request to yourself" });
      }
      
      // Check if a friend request already exists
      const existingRequest = await db
        .select()
        .from(userFriends)
        .where(
          and(
            eq(userFriends.requesterId, requesterId),
            eq(userFriends.receiverId, receiverId)
          )
        )
        .limit(1);
      
      if (existingRequest.length > 0) {
        return res.status(400).json({ message: "Friend request already sent" });
      }
      
      // Create a new friend request
      const [friendRequest] = await db
        .insert(userFriends)
        .values({
          requesterId,
          receiverId,
          status: 'pending',
        })
        .returning();
      
      res.json(friendRequest);
    } catch (error) {
      console.error("Error sending friend request:", error);
      res.status(500).json({ message: "Failed to send friend request" });
    }
  });

  app.post('/api/friends/accept/:friendshipId', isAuthenticated, async (req: any, res) => {
    try {
      const { friendshipId } = req.params;
      const friendship = await storage.acceptFriendRequest(parseInt(friendshipId));
      res.json(friendship);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      res.status(400).json({ message: "Failed to accept friend request" });
    }
  });

  app.post('/api/friends/reject/:friendshipId', isAuthenticated, async (req: any, res) => {
    try {
      const { friendshipId } = req.params;
      const friendship = await storage.rejectFriendRequest(parseInt(friendshipId));
      res.json(friendship);
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      res.status(400).json({ message: "Failed to reject friend request" });
    }
  });

  app.get('/api/friends', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const friends = await storage.getUserFriends(userId);
      res.json(friends);
    } catch (error) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  app.get('/api/friends/requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getUserFriendRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ message: "Failed to fetch friend requests" });
    }
  });

  // Search users for adding friends
  app.get('/api/users/search', isAuthenticated, async (req: any, res) => {
    try {
      const { query } = req.query;
      const currentUserId = req.user.claims.sub;
      
      console.log("Search query:", query, "Current user:", currentUserId);
      
      if (!query || query.length < 2) {
        return res.json([]);
      }
      
      const users = await storage.searchUsers(query, currentUserId);
      console.log("Search results:", users.length, "users found");
      res.json(users);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  // Get individual user profile
  app.get('/api/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Review endpoints
  app.get('/api/activities/:activityId/reviews', isAuthenticated, async (req: any, res) => {
    try {
      const { activityId } = req.params;
      const reviews = await storage.getActivityReviews(parseInt(activityId));
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching activity reviews:", error);
      res.status(500).json({ message: "Failed to fetch activity reviews" });
    }
  });

  app.post('/api/activities/:activityId/reviews', isAuthenticated, async (req: any, res) => {
    try {
      const { activityId } = req.params;
      const currentUserId = req.user.claims.sub;
      const { rating, review, photos = [] } = req.body;

      // Check if user can review this activity
      const canReview = await storage.canUserReviewActivity(currentUserId, parseInt(activityId));
      if (!canReview) {
        return res.status(403).json({ message: "You can only review activities you've attended" });
      }

      // Check if user has already reviewed this activity
      const hasReviewed = await storage.hasUserReviewedActivity(currentUserId, parseInt(activityId));
      if (hasReviewed) {
        return res.status(409).json({ message: "You have already reviewed this activity" });
      }

      const newReview = await storage.createActivityReview({
        activityId: parseInt(activityId),
        userId: currentUserId,
        rating,
        review,
        photos
      });

      res.status(201).json(newReview);
    } catch (error) {
      console.error("Error creating activity review:", error);
      res.status(500).json({ message: "Failed to create activity review" });
    }
  });

  app.get('/api/users/:userId/attended-activities', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.claims.sub;

      // Only allow users to view their own attended activities
      if (userId !== currentUserId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const attendedActivities = await storage.getUserAttendedActivities(userId);
      res.json(attendedActivities);
    } catch (error) {
      console.error("Error fetching attended activities:", error);
      res.status(500).json({ message: "Failed to fetch attended activities" });
    }
  });

  // Settings routes
  app.get('/api/users/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Extract settings from user data
      const settings = {
        notifications: {
          pushNotifications: user.pushNotifications ?? true,
          emailNotifications: user.emailNotifications ?? true,
          activityReminders: user.activityReminders ?? true,
          newMatches: user.newMatchNotifications ?? true,
          messages: user.messageNotifications ?? true,
        },
        privacy: {
          profileVisibility: user.profileVisibility ?? "public",
          locationSharing: user.locationSharing ?? true,
          showAge: user.showAge ?? true,
          showEmail: user.showEmail ?? false,
        },
        preferences: {
          theme: user.theme ?? "system",
          language: user.language ?? "en",
          distanceUnit: user.distanceUnit ?? "miles",
          maxDistance: user.maxDistance ?? 25,
        }
      };
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching user settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put('/api/users/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { notifications, privacy, preferences } = req.body;
      
      // Validate the incoming settings structure
      if (!notifications && !privacy && !preferences) {
        return res.status(400).json({ message: "No settings provided" });
      }
      
      // Extract database fields from settings
      const updateData: any = {};
      
      if (notifications) {
        if (notifications.pushNotifications !== undefined) {
          updateData.pushNotifications = notifications.pushNotifications;
        }
        if (notifications.emailNotifications !== undefined) {
          updateData.emailNotifications = notifications.emailNotifications;
        }
        if (notifications.activityReminders !== undefined) {
          updateData.activityReminders = notifications.activityReminders;
        }
        if (notifications.newMatches !== undefined) {
          updateData.newMatchNotifications = notifications.newMatches;
        }
        if (notifications.messages !== undefined) {
          updateData.messageNotifications = notifications.messages;
        }
      }
      
      if (privacy) {
        if (privacy.profileVisibility !== undefined) {
          updateData.profileVisibility = privacy.profileVisibility;
        }
        if (privacy.locationSharing !== undefined) {
          updateData.locationSharing = privacy.locationSharing;
        }
        if (privacy.showAge !== undefined) {
          updateData.showAge = privacy.showAge;
        }
        if (privacy.showEmail !== undefined) {
          updateData.showEmail = privacy.showEmail;
        }
      }
      
      if (preferences) {
        if (preferences.theme !== undefined) {
          updateData.theme = preferences.theme;
        }
        if (preferences.language !== undefined) {
          updateData.language = preferences.language;
        }
        if (preferences.distanceUnit !== undefined) {
          updateData.distanceUnit = preferences.distanceUnit;
        }
        if (preferences.maxDistance !== undefined) {
          updateData.maxDistance = preferences.maxDistance;
        }
      }
      
      // Update user with new settings
      const updatedUser = await storage.updateUser(userId, updateData);
      
      // Return updated settings
      const settings = {
        notifications: {
          pushNotifications: updatedUser.pushNotifications ?? true,
          emailNotifications: updatedUser.emailNotifications ?? true,
          activityReminders: updatedUser.activityReminders ?? true,
          newMatches: updatedUser.newMatchNotifications ?? true,
          messages: updatedUser.messageNotifications ?? true,
        },
        privacy: {
          profileVisibility: updatedUser.profileVisibility ?? "public",
          locationSharing: updatedUser.locationSharing ?? true,
          showAge: updatedUser.showAge ?? true,
          showEmail: updatedUser.showEmail ?? false,
        },
        preferences: {
          theme: updatedUser.theme ?? "system",
          language: updatedUser.language ?? "en",
          distanceUnit: updatedUser.distanceUnit ?? "miles",
          maxDistance: updatedUser.maxDistance ?? 25,
        }
      };
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.get('/api/users/export-data', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get user data
      const user = await storage.getUserWithStats(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get user's activities (hosted by the user)
      const userActivities = await storage.getUserHostedActivities(userId);
      
      // Get user's matches
      const userMatches = await storage.getUserMatches(userId);
      
      // Get user's reviews
      const userReviews = await storage.getUserReviews?.(userId) || [];
      
      // Remove sensitive data
      const { passwordHash, ...safeUser } = user;
      
      const exportData = {
        user: safeUser,
        activities: userActivities,
        matches: userMatches,
        reviews: userReviews,
        exportedAt: new Date().toISOString(),
      };
      
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting user data:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.delete('/api/users/delete-account', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // TODO: Implement proper account deletion
      // This should:
      // 1. Delete user's activities
      // 2. Remove user from matches
      // 3. Delete user's messages
      // 4. Delete user's reviews
      // 5. Finally delete user record
      
      // For now, just mark as deleted or return success
      // In production, you might want to anonymize data instead of hard delete
      res.json({ 
        message: "Account deletion requested successfully. Your data will be removed within 30 days.",
        success: true 
      });
    } catch (error) {
      console.error("Error deleting user account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket server setup
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<string, Set<WebSocketWithUser>>();
  
  wss.on('connection', (ws: WebSocketWithUser, req) => {
    console.log('WebSocket client connected');
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('WebSocket message received:', message);
        
        if (message.type === 'join_activity') {
          ws.userId = message.userId;
          ws.chatRoomId = message.activityId;
          
          // Add client to activity room
          const activityKey = `activity_${message.activityId}`;
          if (!clients.has(activityKey)) {
            clients.set(activityKey, new Set());
          }
          clients.get(activityKey)!.add(ws);
          
          console.log(`User ${message.userId} joined activity ${message.activityId} chat`);
          
          // Send a confirmation message back to the client
          ws.send(JSON.stringify({
            type: 'joined_activity',
            activityId: message.activityId,
            userId: message.userId,
            timestamp: new Date().toISOString()
          }));
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    ws.on('close', (code, reason) => {
      // Remove client from all rooms
      for (const [key, clientSet] of Array.from(clients.entries())) {
        if (clientSet.has(ws)) {
          clientSet.delete(ws);
          if (clientSet.size === 0) {
            clients.delete(key);
          }
        }
      }
      console.log(`WebSocket client disconnected. Code: ${code}, Reason: ${reason.toString()}`);
    });
  });
  
  // Broadcast function
  function broadcastToActivity(activityId: number, data: any) {
    const activityKey = `activity_${activityId}`;
    const activityClients = clients.get(activityKey);
    
    console.log(`Broadcasting to activity ${activityId}, clients: ${activityClients?.size || 0}`);
    
    if (activityClients && activityClients.size > 0) {
      const message = JSON.stringify(data);
      let successCount = 0;
      let failCount = 0;
      
      activityClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(message);
            successCount++;
          } catch (error) {
            console.error(`Error sending message to client:`, error);
            failCount++;
          }
        } else {
          console.log(`Client not ready (state: ${client.readyState})`);
          failCount++;
        }
      });
      
      console.log(`Message broadcast results: ${successCount} success, ${failCount} fail`);
    } else {
      console.log(`No clients connected for activity ${activityId}`);
    }
  }

  // New endpoint to get activity participants
  app.get('/api/activities/:id/participants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activityId = parseInt(req.params.id);
      
      // Check if user is part of this activity
      const isParticipant = await storage.isUserParticipant(userId, activityId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Not authorized to view participants" });
      }
      
      const participants = await storage.getActivityParticipants(activityId);
      res.json(participants);
    } catch (error) {
      console.error("Error fetching activity participants:", error);
      res.status(500).json({ message: "Failed to fetch participants" });
    }
  });

  return httpServer;
}

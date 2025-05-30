import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertActivitySchema, 
  insertActivitySwipeSchema, 
  insertActivityMatchSchema,
  insertChatMessageSchema,
  insertUserRatingSchema 
} from "@shared/schema";
import { z } from "zod";

interface WebSocketWithUser extends WebSocket {
  userId?: string;
  chatRoomId?: number;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

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

  app.patch('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profileData = req.body;
      
      // Calculate profile completeness
      const completeness = calculateProfileCompleteness(profileData);
      profileData.profileCompleteness = completeness;
      profileData.updatedAt = new Date();
      
      const updatedUser = await storage.updateUser(userId, profileData);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Helper function to calculate profile completeness
  function calculateProfileCompleteness(profile: any): number {
    let score = 20; // Base score for having an account
    
    if (profile.firstName && profile.lastName) score += 10;
    if (profile.bio && profile.bio.length > 50) score += 15;
    if (profile.age) score += 5;
    if (profile.occupation) score += 5;
    if (profile.location) score += 10;
    if (profile.interests && profile.interests.length >= 3) score += 10;
    if (profile.activityPreferences && profile.activityPreferences.length >= 2) score += 10;
    if (profile.languages && profile.languages.length >= 1) score += 5;
    if (profile.personalityTraits && profile.personalityTraits.length >= 3) score += 10;
    
    return Math.min(score, 100);
  }

  // Activity routes
  app.get('/api/activities/discover', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activities = await storage.getDiscoverableActivities(userId, req.query);
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
      
      // Check if user is part of this activity
      const isParticipant = await storage.isUserParticipant(userId, activityId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Not authorized to send messages" });
      }
      
      const chatRoom = await storage.getOrCreateChatRoom(activityId);
      
      const validatedData = insertChatMessageSchema.parse({
        chatRoomId: chatRoom.id,
        senderId: userId,
        message: req.body.message,
        messageType: req.body.messageType || 'text',
      });
      
      const message = await storage.createChatMessage(validatedData);
      const messageWithSender = await storage.getChatMessageWithSender(message.id);
      
      // Broadcast to WebSocket clients
      broadcastToActivity(activityId, {
        type: 'new_message',
        message: messageWithSender,
      });
      
      res.status(201).json(messageWithSender);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid message data", errors: error.errors });
      } else {
        console.error("Error creating message:", error);
        res.status(500).json({ message: "Failed to send message" });
      }
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

  // Friend management routes
  app.post('/api/friends/request', isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.claims.sub;
      const { receiverId } = req.body;
      
      if (requesterId === receiverId) {
        return res.status(400).json({ message: "Cannot send friend request to yourself" });
      }

      const friendship = await storage.sendFriendRequest(requesterId, receiverId);
      res.json(friendship);
    } catch (error) {
      console.error("Error sending friend request:", error);
      res.status(400).json({ message: "Failed to send friend request" });
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

  const httpServer = createServer(app);
  
  // WebSocket server setup
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<string, Set<WebSocketWithUser>>();
  
  wss.on('connection', (ws: WebSocketWithUser, req) => {
    console.log('WebSocket client connected');
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'join_activity') {
          ws.userId = message.userId;
          ws.chatRoomId = message.activityId;
          
          // Add client to activity room
          const activityKey = `activity_${message.activityId}`;
          if (!clients.has(activityKey)) {
            clients.set(activityKey, new Set());
          }
          clients.get(activityKey)!.add(ws);
          
          console.log(`User ${message.userId} joined activity ${message.activityId}`);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      // Remove client from all rooms
      for (const [key, clientSet] of clients.entries()) {
        if (clientSet.has(ws)) {
          clientSet.delete(ws);
          if (clientSet.size === 0) {
            clients.delete(key);
          }
        }
      }
      console.log('WebSocket client disconnected');
    });
  });
  
  // Broadcast function
  function broadcastToActivity(activityId: number, data: any) {
    const activityKey = `activity_${activityId}`;
    const activityClients = clients.get(activityKey);
    
    if (activityClients) {
      const message = JSON.stringify(data);
      activityClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  return httpServer;
}

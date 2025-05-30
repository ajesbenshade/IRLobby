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

  // Populate sample data on startup
  try {
    await storage.populateSampleData();
    console.log("Sample data populated successfully");
  } catch (error) {
    console.error("Error populating sample data:", error);
  }

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

  // Add sample events endpoint
  app.post('/api/admin/populate-events', async (req, res) => {
    try {
      const additionalEvents = [
        { title: "Sunrise Hike at Wissahickon", location: "Wissahickon Valley Park", hostId: "user_1", category: "adventure", dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), maxParticipants: 12, latitude: 40.0379, longitude: -75.2096, description: "Early morning hike through scenic trails. Coffee and donuts after!", skillLevel: "intermediate", isPrivate: false, requiresApplication: false },
        { title: "Jazz Night at Chris' Jazz Cafe", location: "Chris' Jazz Cafe", hostId: "user_2", category: "entertainment", dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), maxParticipants: 40, latitude: 39.9496, longitude: -75.1503, description: "Live jazz performances in an intimate setting.", skillLevel: "all", isPrivate: false, requiresApplication: false },
        { title: "Basketball Pickup Game", location: "Palumbo Playground", hostId: "user_3", category: "sports", dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), maxParticipants: 10, latitude: 39.9259, longitude: -75.1476, description: "Casual pickup basketball. All skill levels welcome.", skillLevel: "all", isPrivate: false, requiresApplication: false },
        { title: "Farmers Market Exploration", location: "Clark Park Farmers Market", hostId: "user_4", category: "food", dateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), maxParticipants: 8, latitude: 39.9489, longitude: -75.2280, description: "Discover local vendors and fresh produce.", skillLevel: "all", isPrivate: false, requiresApplication: false },
        { title: "Escape Room Challenge", location: "Center City", hostId: "user_5", category: "social", dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), maxParticipants: 6, latitude: 39.9496, longitude: -75.1503, description: "Test your problem-solving skills.", skillLevel: "all", isPrivate: false, requiresApplication: false },
        { title: "Morning Swim Session", location: "FDR Park Pool", hostId: "user_6", category: "fitness", dateTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), maxParticipants: 15, latitude: 39.9010, longitude: -75.1896, description: "Lap swimming followed by healthy breakfast.", skillLevel: "intermediate", isPrivate: false, requiresApplication: false },
        { title: "Karaoke Night", location: "Center City Bar", hostId: "user_7", category: "entertainment", dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), maxParticipants: 25, latitude: 39.9496, longitude: -75.1570, description: "Sing your heart out at the best karaoke spot!", skillLevel: "all", isPrivate: false, requiresApplication: false },
        { title: "Chess Tournament", location: "Rittenhouse Square", hostId: "user_8", category: "social", dateTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), maxParticipants: 16, latitude: 39.9489, longitude: -75.1725, description: "Outdoor chess tournament in the park.", skillLevel: "intermediate", isPrivate: false, requiresApplication: false },
        { title: "Mural Arts Tour", location: "Northern Liberties", hostId: "user_9", category: "culture", dateTime: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000), maxParticipants: 12, latitude: 39.9735, longitude: -75.1404, description: "Guided tour of Philadelphia's incredible murals.", skillLevel: "all", isPrivate: false, requiresApplication: false },
        { title: "Rooftop Yoga", location: "Center City Rooftop", hostId: "user_10", category: "wellness", dateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), maxParticipants: 20, latitude: 39.9496, longitude: -75.1652, description: "Yoga with stunning city skyline views.", skillLevel: "all", isPrivate: false, requiresApplication: false },
        { title: "Ice Skating Fun", location: "Dilworth Park", hostId: "user_11", category: "sports", dateTime: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000), maxParticipants: 18, latitude: 39.9537, longitude: -75.1652, description: "Ice skating followed by hot chocolate.", skillLevel: "all", isPrivate: false, requiresApplication: false },
        { title: "Craft Beer Workshop", location: "Fishtown Brewery", hostId: "user_12", category: "learning", dateTime: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), maxParticipants: 12, latitude: 39.9735, longitude: -75.1354, description: "Learn the art of craft beer brewing.", skillLevel: "beginner", isPrivate: false, requiresApplication: false },
        { title: "Dog Park Meetup", location: "Schuylkill River Park", hostId: "user_13", category: "social", dateTime: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000), maxParticipants: 20, latitude: 39.9656, longitude: -75.1896, description: "Bring your furry friends for socialization!", skillLevel: "all", isPrivate: false, requiresApplication: false },
        { title: "Ghost Tour", location: "Old City", hostId: "user_14", category: "entertainment", dateTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), maxParticipants: 15, latitude: 39.9496, longitude: -75.1503, description: "Spooky walking tour through historic Philadelphia.", skillLevel: "all", isPrivate: false, requiresApplication: false },
        { title: "Ping Pong Tournament", location: "Center City", hostId: "user_15", category: "sports", dateTime: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), maxParticipants: 16, latitude: 39.9496, longitude: -75.1652, description: "Competitive ping pong with prizes.", skillLevel: "intermediate", isPrivate: false, requiresApplication: false },
        { title: "Urban Sketching", location: "Society Hill", hostId: "user_16", category: "arts", dateTime: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000), maxParticipants: 10, latitude: 39.9426, longitude: -75.1503, description: "Sketch beautiful architecture and scenes.", skillLevel: "all", isPrivate: false, requiresApplication: false },
        { title: "Improv Comedy Workshop", location: "Center City Studio", hostId: "user_17", category: "learning", dateTime: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000), maxParticipants: 12, latitude: 39.9496, longitude: -75.1570, description: "Learn improv techniques and have fun.", skillLevel: "beginner", isPrivate: false, requiresApplication: false },
        { title: "Food Truck Festival", location: "Penn's Landing", hostId: "user_18", category: "food", dateTime: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000), maxParticipants: 50, latitude: 39.9496, longitude: -75.1404, description: "Sample cuisines from the best food trucks.", skillLevel: "all", isPrivate: false, requiresApplication: false },
        { title: "Morning Tai Chi", location: "Washington Square Park", hostId: "user_19", category: "wellness", dateTime: new Date(Date.now() + 19 * 24 * 60 * 60 * 1000), maxParticipants: 15, latitude: 39.9426, longitude: -75.1570, description: "Gentle tai chi practice in peaceful setting.", skillLevel: "beginner", isPrivate: false, requiresApplication: false },
        { title: "Vintage Shopping Tour", location: "Queen Village", hostId: "user_20", category: "social", dateTime: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), maxParticipants: 8, latitude: 39.9359, longitude: -75.1503, description: "Explore the best vintage shops.", skillLevel: "all", isPrivate: false, requiresApplication: false }
      ];

      for (const eventData of additionalEvents) {
        await storage.createActivity(eventData);
      }

      res.json({ message: `Added ${additionalEvents.length} new events successfully` });
    } catch (error) {
      console.error("Error adding events:", error);
      res.status(500).json({ message: "Failed to add events" });
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

  // Photo upload routes
  app.post('/api/upload/photo', isAuthenticated, async (req: any, res) => {
    try {
      const { photoData, type } = req.body; // type: 'profile' or 'gallery'
      
      if (!photoData) {
        return res.status(400).json({ message: "Photo data is required" });
      }

      const userId = req.user.claims.sub;
      
      // In a real app, you'd upload to a service like AWS S3, Cloudinary, etc.
      // For now, we'll store the base64 data directly (not recommended for production)
      const photoUrl = photoData; // This would be the URL returned from your upload service
      
      if (type === 'profile') {
        // Update profile image
        await storage.updateUser(userId, { profileImageUrl: photoUrl });
      } else if (type === 'gallery') {
        // Add to gallery
        const user = await storage.getUser(userId);
        const currentGallery = user?.profileGallery || [];
        
        if (currentGallery.length >= 12) {
          return res.status(400).json({ message: "Maximum 12 photos allowed in gallery" });
        }
        
        const updatedGallery = [...currentGallery, photoUrl];
        await storage.updateUser(userId, { profileGallery: updatedGallery });
      }

      res.json({ success: true, photoUrl });
    } catch (error) {
      console.error("Error uploading photo:", error);
      res.status(500).json({ message: "Failed to upload photo" });
    }
  });

  app.delete('/api/upload/photo/:index', isAuthenticated, async (req: any, res) => {
    try {
      const photoIndex = parseInt(req.params.index);
      const userId = req.user.claims.sub;
      
      const user = await storage.getUser(userId);
      const currentGallery = user?.profileGallery || [];
      
      if (photoIndex < 0 || photoIndex >= currentGallery.length) {
        return res.status(400).json({ message: "Invalid photo index" });
      }
      
      const updatedGallery = currentGallery.filter((_, index) => index !== photoIndex);
      await storage.updateUser(userId, { profileGallery: updatedGallery });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting photo:", error);
      res.status(500).json({ message: "Failed to delete photo" });
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

  app.get('/api/friends/search', isAuthenticated, async (req: any, res) => {
    try {
      const { q } = req.query;
      const userId = req.user.claims.sub;
      
      if (!q || typeof q !== 'string') {
        return res.json([]);
      }
      
      const results = await storage.searchUsers(q, userId);
      res.json(results);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  // Sample data population route (for development)
  app.post('/api/populate-sample-data', async (req, res) => {
    try {
      await storage.populateSampleData();
      res.json({ message: "Sample data populated successfully" });
    } catch (error) {
      console.error("Error populating sample data:", error);
      res.status(500).json({ message: "Failed to populate sample data" });
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

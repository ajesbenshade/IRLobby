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
  searchUsers(query: string, currentUserId: string): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // Sample data population
  async populateSampleData(): Promise<void> {
    // Check if data already exists
    const existingActivities = await db.select().from(activities);
    if (existingActivities.length > 50) return; // Don't repopulate if we have enough data

    const sampleUsers = [
      { id: "user_1", email: "alex.martinez@email.com", firstName: "Alex", lastName: "Martinez", profileImageUrl: "https://i.pravatar.cc/150?u=alex", location: "Center City, Philadelphia", occupation: "Software Engineer", bio: "Love hiking, rock climbing, and trying new restaurants. Always up for an adventure!" },
      { id: "user_2", email: "sarah.chen@email.com", firstName: "Sarah", lastName: "Chen", profileImageUrl: "https://i.pravatar.cc/150?u=sarah", location: "Rittenhouse Square, Philadelphia", occupation: "Marketing Manager", bio: "Yoga enthusiast and foodie. Looking to meet new people and explore the city!" },
      { id: "user_3", email: "mike.johnson@email.com", firstName: "Mike", lastName: "Johnson", profileImageUrl: "https://i.pravatar.cc/150?u=mike", location: "Northern Liberties, Philadelphia", occupation: "Teacher", bio: "Basketball player, board game lover, and craft beer enthusiast." },
      { id: "user_4", email: "emma.davis@email.com", firstName: "Emma", lastName: "Davis", profileImageUrl: "https://i.pravatar.cc/150?u=emma", location: "Fishtown, Philadelphia", occupation: "Graphic Designer", bio: "Art galleries, live music, and weekend farmers markets are my thing!" },
      { id: "user_5", email: "david.lee@email.com", firstName: "David", lastName: "Lee", profileImageUrl: "https://i.pravatar.cc/150?u=david", location: "University City, Philadelphia", occupation: "Data Scientist", bio: "Tennis player and tech meetup organizer. Love discussing AI and machine learning." },
      { id: "user_6", email: "jessica.brown@email.com", firstName: "Jessica", lastName: "Brown", profileImageUrl: "https://i.pravatar.cc/150?u=jessica", location: "Old City, Philadelphia", occupation: "Nurse", bio: "Running marathons and volunteering at animal shelters. Looking for active friends!" },
      { id: "user_7", email: "ryan.wilson@email.com", firstName: "Ryan", lastName: "Wilson", profileImageUrl: "https://i.pravatar.cc/150?u=ryan", location: "South Philadelphia", occupation: "Chef", bio: "Food truck owner who loves cooking classes and wine tastings." },
      { id: "user_8", email: "lisa.garcia@email.com", firstName: "Lisa", lastName: "Garcia", profileImageUrl: "https://i.pravatar.cc/150?u=lisa", location: "Manayunk, Philadelphia", occupation: "Real Estate Agent", bio: "Cyclist and photography enthusiast. Always exploring new neighborhoods!" },
      { id: "user_9", email: "chris.taylor@email.com", firstName: "Chris", lastName: "Taylor", profileImageUrl: "https://i.pravatar.cc/150?u=chris", location: "Graduate Hospital, Philadelphia", occupation: "Lawyer", bio: "Trivia night champion and amateur comedian. Love standup shows and karaoke." },
      { id: "user_10", email: "amanda.white@email.com", firstName: "Amanda", lastName: "White", profileImageUrl: "https://i.pravatar.cc/150?u=amanda", location: "Kensington, Philadelphia", occupation: "Social Worker", bio: "Community garden volunteer and book club member. Passionate about social justice." },
      { id: "user_11", email: "kevin.harris@email.com", firstName: "Kevin", lastName: "Harris", profileImageUrl: "https://i.pravatar.cc/150?u=kevin", location: "Port Richmond, Philadelphia", occupation: "Mechanic", bio: "Classic car restoration and local history buff. Love Philly sports!" },
      { id: "user_12", email: "melissa.clark@email.com", firstName: "Melissa", lastName: "Clark", profileImageUrl: "https://i.pravatar.cc/150?u=melissa", location: "Chestnut Hill, Philadelphia", occupation: "Veterinarian", bio: "Dog park regular and hiking enthusiast. Always up for outdoor adventures." },
      { id: "user_13", email: "jason.lewis@email.com", firstName: "Jason", lastName: "Lewis", profileImageUrl: "https://i.pravatar.cc/150?u=jason", location: "Fairmount, Philadelphia", occupation: "Personal Trainer", bio: "Fitness enthusiast who loves rock climbing and CrossFit competitions." },
      { id: "user_14", email: "nicole.walker@email.com", firstName: "Nicole", lastName: "Walker", profileImageUrl: "https://i.pravatar.cc/150?u=nicole", location: "Queen Village, Philadelphia", occupation: "Event Planner", bio: "Concert goer and festival organizer. Love bringing people together!" },
      { id: "user_15", email: "brian.hall@email.com", firstName: "Brian", lastName: "Hall", profileImageUrl: "https://i.pravatar.cc/150?u=brian", location: "Brewerytown, Philadelphia", occupation: "Architect", bio: "Urban sketching and craft brewery tours. Fascinated by city design." },
      { id: "user_16", email: "rachel.young@email.com", firstName: "Rachel", lastName: "Young", profileImageUrl: "https://i.pravatar.cc/150?u=rachel", location: "Society Hill, Philadelphia", occupation: "Museum Curator", bio: "Art history nerd and antique collector. Love museum hopping and cultural events." },
      { id: "user_17", email: "scott.king@email.com", firstName: "Scott", lastName: "King", profileImageUrl: "https://i.pravatar.cc/150?u=scott", location: "Point Breeze, Philadelphia", occupation: "Firefighter", bio: "Volunteer EMT and community service advocate. Enjoy pickup basketball games." },
      { id: "user_18", email: "lauren.wright@email.com", firstName: "Lauren", lastName: "Wright", profileImageUrl: "https://i.pravatar.cc/150?u=lauren", location: "Bella Vista, Philadelphia", occupation: "Journalist", bio: "Local news reporter who loves investigating Philly's hidden gems and food scene." },
      { id: "user_19", email: "daniel.lopez@email.com", firstName: "Daniel", lastName: "Lopez", profileImageUrl: "https://i.pravatar.cc/150?u=daniel", location: "Callowhill, Philadelphia", occupation: "Construction Manager", bio: "Woodworking hobbyist and home brewing enthusiast. Love DIY projects." },
      { id: "user_20", email: "stephanie.hill@email.com", firstName: "Stephanie", lastName: "Hill", profileImageUrl: "https://i.pravatar.cc/150?u=stephanie", location: "Germantown, Philadelphia", occupation: "Elementary Teacher", bio: "Community theater actor and children's book author. Creative and fun-loving!" },
      { id: "user_21", email: "matt.green@email.com", firstName: "Matt", lastName: "Green", profileImageUrl: "https://i.pravatar.cc/150?u=matt", location: "East Passyunk, Philadelphia", occupation: "Electrician", bio: "Motorcycle rider and blues music fan. Love exploring new music venues." },
      { id: "user_22", email: "kimberly.adams@email.com", firstName: "Kimberly", lastName: "Adams", profileImageUrl: "https://i.pravatar.cc/150?u=kimberly", location: "Mount Airy, Philadelphia", occupation: "Physical Therapist", bio: "Yoga instructor and wellness coach. Passionate about healthy living." },
      { id: "user_23", email: "anthony.baker@email.com", firstName: "Anthony", lastName: "Baker", profileImageUrl: "https://i.pravatar.cc/150?u=anthony", location: "West Philadelphia", occupation: "Music Producer", bio: "Hip-hop producer and vinyl collector. Always looking for new talent and sounds." },
      { id: "user_24", email: "crystal.nelson@email.com", firstName: "Crystal", lastName: "Nelson", profileImageUrl: "https://i.pravatar.cc/150?u=crystal", location: "Passyunk Square, Philadelphia", occupation: "Pharmacist", bio: "Salsa dancing instructor and language exchange enthusiast. Hablo español!" },
      { id: "user_25", email: "tyler.carter@email.com", firstName: "Tyler", lastName: "Carter", profileImageUrl: "https://i.pravatar.cc/150?u=tyler", location: "Spring Garden, Philadelphia", occupation: "Web Developer", bio: "Gaming enthusiast and tech startup founder. Love hackathons and innovation." },
      { id: "user_26", email: "monica.mitchell@email.com", firstName: "Monica", lastName: "Mitchell", profileImageUrl: "https://i.pravatar.cc/150?u=monica", location: "Francisville, Philadelphia", occupation: "Interior Designer", bio: "Antique shopping and home renovation projects. Love transforming spaces!" },
      { id: "user_27", email: "jordan.perez@email.com", firstName: "Jordan", lastName: "Perez", profileImageUrl: "https://i.pravatar.cc/150?u=jordan", location: "Graduate Hospital, Philadelphia", occupation: "Financial Advisor", bio: "Investment club organizer and economic podcast host. Numbers and trends fascinate me." },
      { id: "user_28", email: "tiffany.roberts@email.com", firstName: "Tiffany", lastName: "Roberts", profileImageUrl: "https://i.pravatar.cc/150?u=tiffany", location: "Northern Liberties, Philadelphia", occupation: "Hair Stylist", bio: "Fashion week attendee and beauty blogger. Love experimenting with new looks!" },
      { id: "user_29", email: "marcus.turner@email.com", firstName: "Marcus", lastName: "Turner", profileImageUrl: "https://i.pravatar.cc/150?u=marcus", location: "West Kensington, Philadelphia", occupation: "Social Media Manager", bio: "Content creator and digital marketing strategist. Always chasing the next viral trend." },
      { id: "user_30", email: "natalie.phillips@email.com", firstName: "Natalie", lastName: "Phillips", profileImageUrl: "https://i.pravatar.cc/150?u=natalie", location: "Hawthorne, Philadelphia", occupation: "Librarian", bio: "Book club leader and local history researcher. Love quiet coffee shops and archives." },
      { id: "user_31", email: "carlos.campbell@email.com", firstName: "Carlos", lastName: "Campbell", profileImageUrl: "https://i.pravatar.cc/150?u=carlos", location: "South Kensington, Philadelphia", occupation: "Paramedic", bio: "Emergency responder and community safety advocate. Love adventure sports and adrenaline." },
      { id: "user_32", email: "vanessa.parker@email.com", firstName: "Vanessa", lastName: "Parker", profileImageUrl: "https://i.pravatar.cc/150?u=vanessa", location: "Olde Richmond, Philadelphia", occupation: "Wedding Planner", bio: "Event coordination specialist and flower arranging enthusiast. Love making dreams come true!" },
      { id: "user_33", email: "derek.evans@email.com", firstName: "Derek", lastName: "Evans", profileImageUrl: "https://i.pravatar.cc/150?u=derek", location: "Pennsport, Philadelphia", occupation: "Police Officer", bio: "Community policing advocate and youth mentor. Coaching little league in my spare time." },
      { id: "user_34", email: "samantha.edwards@email.com", firstName: "Samantha", lastName: "Edwards", profileImageUrl: "https://i.pravatar.cc/150?u=samantha", location: "East Mount Airy, Philadelphia", occupation: "Occupational Therapist", bio: "Adaptive sports coordinator and accessibility advocate. Helping others achieve their goals." },
      { id: "user_35", email: "brandon.collins@email.com", firstName: "Brandon", lastName: "Collins", profileImageUrl: "https://i.pravatar.cc/150?u=brandon", location: "Juniata Park, Philadelphia", occupation: "HVAC Technician", bio: "Home improvement enthusiast and local sports league organizer. Fixing things is my passion." },
      { id: "user_36", email: "andrea.stewart@email.com", firstName: "Andrea", lastName: "Stewart", profileImageUrl: "https://i.pravatar.cc/150?u=andrea", location: "Graduate Hospital, Philadelphia", occupation: "Dietitian", bio: "Nutrition coach and farmers market vendor. Passionate about sustainable eating." },
      { id: "user_37", email: "gregory.sanchez@email.com", firstName: "Gregory", lastName: "Sanchez", profileImageUrl: "https://i.pravatar.cc/150?u=gregory", location: "Fishtown, Philadelphia", occupation: "Bartender", bio: "Craft cocktail creator and nightlife connoisseur. Love discovering new speakeasies." },
      { id: "user_38", email: "patricia.morris@email.com", firstName: "Patricia", lastName: "Morris", profileImageUrl: "https://i.pravatar.cc/150?u=patricia", location: "University City, Philadelphia", occupation: "Research Scientist", bio: "Lab researcher and science communication advocate. Making complex topics accessible to everyone." },
      { id: "user_39", email: "kenneth.rogers@email.com", firstName: "Kenneth", lastName: "Rogers", profileImageUrl: "https://i.pravatar.cc/150?u=kenneth", location: "Nicetown, Philadelphia", occupation: "Bus Driver", bio: "Public transportation advocate and city tour guide. Know every street in Philly!" },
      { id: "user_40", email: "lindsay.reed@email.com", firstName: "Lindsay", lastName: "Reed", profileImageUrl: "https://i.pravatar.cc/150?u=lindsay", location: "East Kensington, Philadelphia", occupation: "Massage Therapist", bio: "Holistic wellness practitioner and meditation instructor. Helping people find balance." },
      { id: "user_41", email: "jerome.cook@email.com", firstName: "Jerome", lastName: "Cook", profileImageUrl: "https://i.pravatar.cc/150?u=jerome", location: "Strawberry Mansion, Philadelphia", occupation: "Plumber", bio: "Home renovation specialist and local handball champion. Problem-solving is my superpower." },
      { id: "user_42", email: "megan.bailey@email.com", firstName: "Megan", lastName: "Bailey", profileImageUrl: "https://i.pravatar.cc/150?u=megan", location: "Tacony, Philadelphia", occupation: "Bank Teller", bio: "Financial literacy educator and community volunteer. Love helping people achieve their goals." },
      { id: "user_43", email: "austin.rivera@email.com", firstName: "Austin", lastName: "Rivera", profileImageUrl: "https://i.pravatar.cc/150?u=austin", location: "Port Richmond, Philadelphia", occupation: "Delivery Driver", bio: "Logistics coordinator and amateur photographer. Capturing the city one delivery at a time." },
      { id: "user_44", email: "courtney.cooper@email.com", firstName: "Courtney", lastName: "Cooper", profileImageUrl: "https://i.pravatar.cc/150?u=courtney", location: "Poplar, Philadelphia", occupation: "Dance Instructor", bio: "Contemporary dance teacher and choreographer. Movement is my language of expression." },
      { id: "user_45", email: "benjamin.richardson@email.com", firstName: "Benjamin", lastName: "Richardson", profileImageUrl: "https://i.pravatar.cc/150?u=benjamin", location: "Brewerytown, Philadelphia", occupation: "Graphic Artist", bio: "Street art enthusiast and mural painter. Bringing color and life to neighborhood walls." },
      { id: "user_46", email: "diana.ward@email.com", firstName: "Diana", lastName: "Ward", profileImageUrl: "https://i.pravatar.cc/150?u=diana", location: "Point Breeze, Philadelphia", occupation: "Kindergarten Teacher", bio: "Early childhood education specialist and puppet show performer. Kids are the best audience!" },
      { id: "user_47", email: "nathan.torres@email.com", firstName: "Nathan", lastName: "Torres", profileImageUrl: "https://i.pravatar.cc/150?u=nathan", location: "Kensington, Philadelphia", occupation: "Auto Mechanic", bio: "Classic car restoration and drag racing enthusiast. Speed and precision drive my passion." },
      { id: "user_48", email: "alexa.peterson@email.com", firstName: "Alexa", lastName: "Peterson", profileImageUrl: "https://i.pravatar.cc/150?u=alexa", location: "Fairmount, Philadelphia", occupation: "Marketing Coordinator", bio: "Brand storytelling specialist and podcast producer. Love amplifying unique voices." },
      { id: "user_49", email: "vincent.gray@email.com", firstName: "Vincent", lastName: "Gray", profileImageUrl: "https://i.pravatar.cc/150?u=vincent", location: "Hunting Park, Philadelphia", occupation: "Security Guard", bio: "Community safety volunteer and chess club organizer. Strategy and protection are my focus." },
      { id: "user_50", email: "isabella.ramirez@email.com", firstName: "Isabella", lastName: "Ramirez", profileImageUrl: "https://i.pravatar.cc/150?u=isabella", location: "Logan Square, Philadelphia", occupation: "Translator", bio: "Multilingual communication specialist and cultural bridge-builder. Languages open worlds!" }
    ];

    // Insert sample users
    for (const user of sampleUsers) {
      await db.insert(users).values(user).onConflictDoNothing();
    }

    const sampleActivities = [
      { title: "Morning Yoga in Rittenhouse Square", location: "Rittenhouse Square Park", hostId: "user_2", category: "fitness", dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), maxParticipants: 15, description: "Start your day with peaceful yoga in the heart of the city. All levels welcome!", latitude: 39.9496, longitude: -75.1713, isPrivate: false },
      { title: "Rock Climbing at Go Vertical", location: "Go Vertical Climbing Gym", hostId: "user_1", category: "sports", dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), maxParticipants: 8, description: "Indoor rock climbing session for beginners and intermediate climbers.", latitude: 39.9448, longitude: -75.1839, isPrivate: false },
      { title: "Trivia Night at Misconduct Tavern", location: "Misconduct Tavern", hostId: "user_9", category: "social", dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), maxParticipants: 20, description: "Test your knowledge and meet new people at weekly trivia night!", latitude: 39.9526, longitude: -75.1652, isPrivate: false },
      { title: "Food Truck Tour in University City", location: "University City", hostId: "user_7", category: "food", dateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), maxParticipants: 12, description: "Explore the best food trucks around UPenn and Drexel campuses.", latitude: 39.9522, longitude: -75.1932, isPrivate: false },
      { title: "Photography Walk in Old City", location: "Old City Historic District", hostId: "user_8", category: "creative", dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), maxParticipants: 10, description: "Capture the historic beauty of Philadelphia's Old City neighborhood.", latitude: 39.9495, longitude: -75.1438, isPrivate: false },
      { title: "Basketball Pickup Game", location: "Marian Anderson Recreation Center", hostId: "user_3", category: "sports", dateTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), maxParticipants: 10, description: "Casual pickup basketball game, all skill levels welcome!", latitude: 39.9783, longitude: -75.1534, isPrivate: false },
      { title: "Craft Beer Tasting at Yards Brewing", location: "Yards Brewing Company", hostId: "user_15", category: "social", dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), maxParticipants: 16, description: "Sample local craft beers and learn about the brewing process.", latitude: 39.9712, longitude: -75.1370, isPrivate: false },
      { title: "Running Club at Kelly Drive", location: "Kelly Drive", hostId: "user_6", category: "fitness", dateTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), maxParticipants: 25, description: "Weekly running group along the scenic Schuylkill River trail.", latitude: 39.9703, longitude: -75.1892, isPrivate: false },
      { title: "Art Gallery Opening in Fishtown", location: "Fishtown Gallery District", hostId: "user_4", category: "cultural", dateTime: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000), maxParticipants: 30, description: "Opening night for local artists featuring contemporary Philadelphia art.", latitude: 39.9676, longitude: -75.1274, isPrivate: false },
      { title: "Cooking Class: Italian Cuisine", location: "CookNSolo Test Kitchen", hostId: "user_7", category: "food", dateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), maxParticipants: 12, description: "Learn to make authentic Italian pasta and sauces from scratch.", latitude: 39.9629, longitude: -75.1516, isPrivate: false },
      { title: "Board Game Night at Dice Cafe", location: "Dice Cafe", hostId: "user_3", category: "social", dateTime: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000), maxParticipants: 18, description: "Strategy games, party games, and good company in a cozy cafe setting.", latitude: 39.9459, longitude: -75.1934, isPrivate: false },
      { title: "Salsa Dancing Lessons", location: "Manayunk Dance Studio", hostId: "user_24", category: "creative", dateTime: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), maxParticipants: 20, description: "Learn basic salsa steps and meet new dance partners!", latitude: 40.0225, longitude: -75.2269, isPrivate: false },
      { title: "Bike Ride Through Fairmount Park", location: "Fairmount Park", hostId: "user_8", category: "fitness", dateTime: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000), maxParticipants: 15, description: "Leisurely bike ride through one of America's largest urban parks.", latitude: 39.9896, longitude: -75.2087, isPrivate: false },
      { title: "Wine Tasting at Corkscrew Wine Bar", location: "Corkscrew Wine Bar", hostId: "user_7", category: "social", dateTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), maxParticipants: 14, description: "Guided wine tasting featuring natural and biodynamic wines.", latitude: 39.9625, longitude: -75.1505, isPrivate: false },
      { title: "Tennis Doubles Tournament", location: "Penn Park Tennis Courts", hostId: "user_5", category: "sports", dateTime: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), maxParticipants: 16, description: "Friendly doubles tournament for intermediate to advanced players.", latitude: 39.9482, longitude: -75.1896, isPrivate: false },
      { title: "Stand-up Comedy Open Mic", location: "Punch Line Philly", hostId: "user_9", category: "entertainment", dateTime: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000), maxParticipants: 25, description: "Support local comedians or try your hand at stand-up!", latitude: 39.9526, longitude: -75.1652, isPrivate: false },
      { title: "Farmers Market Tour", location: "Rittenhouse Square Farmers Market", hostId: "user_4", category: "food", dateTime: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000), maxParticipants: 12, description: "Explore local vendors and taste seasonal produce from regional farms.", latitude: 39.9496, longitude: -75.1713, isPrivate: false },
      { title: "Hiking at Wissahickon Valley Park", location: "Wissahickon Valley Park", hostId: "user_1", category: "outdoors", dateTime: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000), maxParticipants: 20, description: "Moderate hike through Philadelphia's most beautiful natural area.", latitude: 40.0349, longitude: -75.2066, isPrivate: false },
      { title: "Karaoke Night at Kung Fu Necktie", location: "Kung Fu Necktie", hostId: "user_9", category: "entertainment", dateTime: new Date(Date.now() + 19 * 24 * 60 * 60 * 1000), maxParticipants: 30, description: "Sing your heart out at one of Fishtown's most popular venues!", latitude: 39.9676, longitude: -75.1274, isPrivate: false },
      { title: "CrossFit Workout at South Philly CrossFit", location: "South Philly CrossFit", hostId: "user_13", category: "fitness", dateTime: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), maxParticipants: 12, description: "High-intensity group workout for all fitness levels.", latitude: 39.9179, longitude: -75.1587, isPrivate: false },
      { title: "Museum Hopping Day", location: "Philadelphia Museum District", hostId: "user_16", category: "cultural", dateTime: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), maxParticipants: 8, description: "Visit multiple museums including PMA, Barnes Foundation, and Rodin Museum.", latitude: 39.9656, longitude: -75.1810, isPrivate: false },
      { title: "Live Jazz at Chris' Jazz Cafe", location: "Chris' Jazz Cafe", hostId: "user_23", category: "entertainment", dateTime: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000), maxParticipants: 20, description: "Enjoy live jazz performances by local and touring musicians.", latitude: 39.9526, longitude: -75.1652, isPrivate: false },
      { title: "Volunteer at Philadelphia Animal Shelter", location: "ACCT Philly", hostId: "user_6", category: "volunteer", dateTime: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000), maxParticipants: 10, description: "Help care for animals waiting for their forever homes.", latitude: 39.9459, longitude: -75.1934, isPrivate: false },
      { title: "Escape Room Challenge", location: "Escape the Room Philly", hostId: "user_25", category: "entertainment", dateTime: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000), maxParticipants: 8, description: "Work together to solve puzzles and escape before time runs out!", latitude: 39.9526, longitude: -75.1652, isPrivate: false },
      { title: "Book Club Discussion", location: "Shakespeare & Co. Bookstore", hostId: "user_30", category: "social", dateTime: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), maxParticipants: 15, description: "Monthly discussion of contemporary fiction and classic literature.", latitude: 39.9459, longitude: -75.1934, isPrivate: false }
    ];

    // Insert sample activities
    for (const activity of sampleActivities) {
      await db.insert(activities).values(activity).onConflictDoNothing();
    }
  }
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

  async searchUsers(query: string, currentUserId: string): Promise<any[]> {
    if (!query.trim()) return [];
    
    const searchTerm = `%${query.toLowerCase()}%`;
    return await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        email: users.email,
        location: users.location,
        occupation: users.occupation
      })
      .from(users)
      .where(and(
        sql`LOWER(${users.firstName}) LIKE ${searchTerm} OR LOWER(${users.lastName}) LIKE ${searchTerm} OR LOWER(${users.email}) LIKE ${searchTerm}`,
        sql`${users.id} != ${currentUserId}`
      ))
      .limit(20);
  }
}

export const storage = new DatabaseStorage();
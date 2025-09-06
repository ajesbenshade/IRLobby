import { db } from './db';
import { users, activities } from '../shared/schema';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: process.cwd() + '/.env' });

// Configuration
const NUM_USERS = 30;
const NUM_ACTIVITIES = 40;

// Categories for activities
const ACTIVITY_CATEGORIES = [
  'Sports', 'Hiking', 'Gaming', 'Music', 'Art', 'Food', 'Drinks',
  'Movies', 'Theatre', 'Dance', 'Technology', 'Educational', 'Networking'
];

// Activity templates with varying capacities and durations
const ACTIVITY_TEMPLATES = [
  { name: 'Basketball Game', category: 'Sports', minCapacity: 6, maxCapacity: 12, duration: 120 },
  { name: 'Soccer Match', category: 'Sports', minCapacity: 10, maxCapacity: 22, duration: 90 },
  { name: 'Tennis Match', category: 'Sports', minCapacity: 2, maxCapacity: 4, duration: 60 },
  { name: 'Hiking Trip', category: 'Hiking', minCapacity: 3, maxCapacity: 15, duration: 180 },
  { name: 'Board Game Night', category: 'Gaming', minCapacity: 3, maxCapacity: 8, duration: 180 },
  { name: 'Live Music Event', category: 'Music', minCapacity: 5, maxCapacity: 50, duration: 180 },
  { name: 'Art Exhibition', category: 'Art', minCapacity: 2, maxCapacity: 20, duration: 120 },
  { name: 'Dinner Party', category: 'Food', minCapacity: 4, maxCapacity: 12, duration: 150 },
  { name: 'Wine Tasting', category: 'Drinks', minCapacity: 4, maxCapacity: 15, duration: 120 },
  { name: 'Movie Night', category: 'Movies', minCapacity: 2, maxCapacity: 10, duration: 180 },
  { name: 'Theater Show', category: 'Theatre', minCapacity: 2, maxCapacity: 6, duration: 150 },
  { name: 'Dance Class', category: 'Dance', minCapacity: 5, maxCapacity: 20, duration: 90 },
  { name: 'Coding Workshop', category: 'Technology', minCapacity: 3, maxCapacity: 15, duration: 180 },
  { name: 'Language Exchange', category: 'Educational', minCapacity: 4, maxCapacity: 12, duration: 120 },
  { name: 'Networking Mixer', category: 'Networking', minCapacity: 10, maxCapacity: 50, duration: 180 }
];

// Helper function to generate a random date in the future (0-30 days)
const getFutureDate = () => {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + Math.floor(Math.random() * 30));
  return futureDate;
};

// Helper function to generate random coordinates within a reasonable range
// Centered roughly around New York City
const getRandomLocation = () => {
  // NYC coordinates: 40.7128° N, 74.0060° W
  const baseLat = 40.7128;
  const baseLng = -74.0060;
  
  // Add some random variation (about 50 mile radius)
  const lat = baseLat + (Math.random() - 0.5) * 0.5;
  const lng = baseLng + (Math.random() - 0.5) * 0.5;
  
  return { latitude: lat, longitude: lng };
};

// Helper function to get random items from an array
const getRandomItems = (array: any[], min: number, max: number) => {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Main function to seed the database
async function seedDatabase() {
  try {
    console.log('Starting database seeding...');
    
    // Generate users
    console.log(`Generating ${NUM_USERS} users...`);
    const userIds = [];
    
    for (let i = 0; i < NUM_USERS; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = faker.internet.email({ firstName, lastName });
      
      // Generate a simple password that's the same for all users for easy testing
      const password = 'password123';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      
      // Generate user location
      const location = getRandomLocation();
      const locationName = faker.location.city();
      
      // Generate random interests (2-5)
      const interests = getRandomItems(ACTIVITY_CATEGORIES, 2, 5);
      
      // Create user object
      const userId = `seed-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      userIds.push(userId);
      
      const photoAlbum = Array(Math.floor(Math.random() * 5) + 1)
        .fill(null)
        .map(() => faker.image.urlLoremFlickr({ category: 'people' }));
      
      // Insert user into database
      await db.insert(users).values({
        id: userId,
        email,
        firstName,
        lastName,
        passwordHash,
        bio: faker.lorem.paragraph(),
        interests: interests,
        photoAlbum: photoAlbum,
        profileImageUrl: faker.image.avatar(),
        location: locationName,
        latitude: location.latitude,
        longitude: location.longitude,
        rating: 3 + Math.random() * 2, // Random rating between 3 and 5
        totalRatings: Math.floor(Math.random() * 50), // Random number of ratings
        eventsHosted: Math.floor(Math.random() * 10),
        eventsAttended: Math.floor(Math.random() * 20)
      });
      
      console.log(`Created user: ${firstName} ${lastName} (${email})`);
    }
    
    // Generate activities
    console.log(`\nGenerating ${NUM_ACTIVITIES} activities...`);
    
    for (let i = 0; i < NUM_ACTIVITIES; i++) {
      // Get a random user ID to be the host
      const hostId = userIds[Math.floor(Math.random() * userIds.length)];
      
      // Get a random activity template
      const template = ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)];
      
      // Generate a random date and time for the activity
      const activityDate = getFutureDate();
      
      // Get random location
      const location = getRandomLocation();
      
      // Generate random participants (0 to max capacity)
      const currentParticipants = Math.min(
        Math.floor(Math.random() * template.maxCapacity),
        template.maxCapacity - 1 // Leave at least one spot open
      );
      
      // Insert activity into database
      await db.insert(activities).values({
        hostId,
        title: `${template.name} with ${faker.person.firstName()}`,
        description: faker.lorem.paragraph(),
        category: template.category,
        location: faker.location.streetAddress(),
        latitude: location.latitude,
        longitude: location.longitude,
        dateTime: activityDate, // Add the dateTime field
        maxParticipants: template.maxCapacity,
        currentParticipants,
        isPrivate: Math.random() < 0.2, // 20% chance of being private
        tags: getRandomItems(ACTIVITY_CATEGORIES, 1, 3),
        imageUrl: faker.image.urlLoremFlickr({ category: template.category.toLowerCase() }),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`Created activity: ${template.name} (Host: ${hostId})`);
    }
    
    console.log('\nDatabase seeding completed successfully!');
    console.log(`Created ${NUM_USERS} users and ${NUM_ACTIVITIES} activities.`);
    console.log('\nTest user credentials:');
    console.log('Email: Any of the generated emails');
    console.log('Password: password123');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    // Close the database connection
    process.exit(0);
  }
}

// Run the seeding function
seedDatabase();

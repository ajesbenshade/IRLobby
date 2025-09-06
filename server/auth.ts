import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import dotenv from 'dotenv';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

dotenv.config({ path: process.cwd() + '/.env' });

// Ensure JWT_SECRET is set for local development
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'local-development-jwt-secret';
  console.log('Using mock JWT_SECRET for local development');
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: 'sessions',
  });
  
  // Set a default SESSION_SECRET for local development
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = 'local-development-session-secret';
    console.log('Using mock SESSION_SECRET for local development');
  }
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

// Helper to generate JWT token
export const generateToken = (userId: string) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: '7d',
  });
};

// Middleware to check if user is authenticated
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

    if (!token) {
      console.log('No authentication token provided');
      return res.status(401).json({ message: 'Authentication required' });
    }

    console.log(`Validating token: ${token.substring(0, 10)}...`);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      console.log(`Token decoded for user: ${decoded.userId}`);
      
      // Fetch user from database
      const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
      
      if (!user || user.length === 0) {
        console.log(`User not found for id: ${decoded.userId}`);
        return res.status(401).json({ message: 'Invalid token - user not found' });
      }

      console.log(`User authenticated: ${user[0].firstName || user[0].id}`);
      
      // Attach user to request object
      (req as any).user = {
        claims: {
          sub: decoded.userId // This matches the format expected in routes.ts
        },
        ...user[0] // Add the user data as well
      };
      
      next();
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      return res.status(401).json({ message: 'Invalid token - verification failed' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

// Register a new user
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email!, email)).limit(1);
    
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in database
    const userId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await db.insert(users).values({
      id: userId,
      email,
      firstName,
      lastName,
      passwordHash: hashedPassword,
    });

    // Generate JWT token
    const token = generateToken(userId);

    // Return token
    return res.status(201).json({ token, userId });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Server error during registration' });
  }
};

// Login an existing user
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const userArray = await db.select().from(users).where(eq(users.email!, email)).limit(1);
    
    if (userArray.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = userArray[0];

    // Check password
    if (!user.passwordHash) {
      return res.status(400).json({ message: 'Password not set for this account' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Return token
    return res.status(200).json({ token, userId: user.id });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login' });
  }
};

// Get current user
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // User is attached to request by isAuthenticated middleware
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Return user data (excluding sensitive information)
    const { passwordHash, ...userData } = user;
    return res.status(200).json(userData);
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// In-memory store for reset tokens (use a database in production)
const resetTokens: Record<string, { userId: string; expiresAt: number }> = {};

// Endpoint to request a password reset
export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await db.select().from(users).where(eq(users.email!, email)).limit(1);
    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 3600 * 1000; // 1 hour
    resetTokens[token] = { userId: user[0].id, expiresAt };

    // Send email with reset link
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      text: `Click the link to reset your password: ${resetLink}`,
    });

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({ message: 'Failed to request password reset' });
  }
};

// Endpoint to reset the password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    // Validate token
    const resetToken = resetTokens[token];
    if (!resetToken || resetToken.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update the user's password
    await db.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, resetToken.userId));

    // Delete the token
    delete resetTokens[token];

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};

// Setup authentication routes
export const setupAuth = (app: any) => {
  app.post('/api/register', register);
  app.post('/api/login', login);
  app.get('/api/user', isAuthenticated, getCurrentUser);
  app.get('/api/logout', (req: Request, res: Response) => {
    res.clearCookie('token');
    return res.status(200).json({ message: 'Logged out successfully' });
  });
  app.post('/api/request-password-reset', requestPasswordReset);
  app.post('/api/reset-password', resetPassword);
};

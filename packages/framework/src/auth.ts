import { KenxRequest, KenxResponse, NextFunction } from './index';
import * as crypto from 'crypto';

// JWT implementation without external dependencies
export class JWT {
  private static encode64(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=/g, '');
  }
  
  private static decode64(str: string): any {
    const padded = str + '='.repeat((4 - str.length % 4) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString());
  }
  
  private static sign(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/=/g, '');
  }
  
  static create(payload: any, secret: string, expiresIn: string | number = '24h'): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    
    // Calculate expiration
    let exp: number;
    if (typeof expiresIn === 'string') {
      const match = expiresIn.match(/^(\d+)([smhd])$/);
      if (!match) throw new Error('Invalid expiresIn format');
      
      const value = parseInt(match[1]);
      const unit = match[2];
      const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
      exp = Math.floor(Date.now() / 1000) + Math.floor((value * multipliers[unit as keyof typeof multipliers]) / 1000);
    } else {
      exp = Math.floor(Date.now() / 1000) + expiresIn;
    }
    
    const tokenPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp
    };
    
    const encodedHeader = this.encode64(header);
    const encodedPayload = this.encode64(tokenPayload);
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`, secret);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }
  
  static verify(token: string, secret: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    const [encodedHeader, encodedPayload, signature] = parts;
    
    // Verify signature
    const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`, secret);
    if (signature !== expectedSignature) {
      throw new Error('Invalid JWT signature');
    }
    
    // Decode payload
    const payload = this.decode64(encodedPayload);
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('JWT token expired');
    }
    
    return payload;
  }
  
  static decode(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    return this.decode64(parts[1]);
  }
}

// Flexible authentication middleware that supports both sessions and JWT
export function auth(options: {
  jwt?: {
    secret: string;
    cookieName?: string;
    headerName?: string;
  };
  session?: boolean;
  redirectTo?: string;
} = {}): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    let authenticated = false;
    
    // Try JWT authentication first (for API/mobile)
    if (options.jwt) {
      try {
        let token: string | undefined;
        
        // Check Authorization header (Bearer token)
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
        
        // Check custom header
        if (!token && options.jwt.headerName) {
          token = req.headers[options.jwt.headerName.toLowerCase()] as string;
        }
          // Check cookie
        if (!token && options.jwt.cookieName) {
          const cookies = req.headers.cookie;
          if (cookies) {
            const tokenCookie = cookies.split(';').find(c => 
              c.trim().startsWith(`${options.jwt!.cookieName}=`)
            );
            if (tokenCookie) {
              token = tokenCookie.split('=')[1];
            }
          }
        }
        
        if (token) {
          const payload = JWT.verify(token, options.jwt.secret);
          req.user = payload;
          authenticated = true;
        }
      } catch (error) {
        // JWT verification failed, continue to session auth
      }
    }
    
    // Fallback to session authentication (for web)
    if (!authenticated && options.session !== false) {
      authenticated = req.isAuthenticated();
    }
    
    if (!authenticated) {
      // If this is an API request, return JSON error
      if (req.url?.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
        return res.error('Authentication required', 401);
      }
      
      // For web requests, redirect to login page or render login template
      if (req.headers.accept?.includes('text/html')) {
        const redirectTo = options.redirectTo || '/login';
        
        // Try to render login template, fallback to redirect
        try {
          return res.render('auth/login', {
            title: 'Login Required',
            returnUrl: req.url,
            error: 'Please log in to access this page'
          });
        } catch {
          res.status(302);
          res.setHeader('Location', redirectTo);
          res.end();
          return;
        }
      }
      
      return res.error('Authentication required', 401);
    }
    
    next();
  };
}

// JWT-only authentication middleware (for pure API endpoints)
export function jwtAuth(secret: string): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    try {
      let token: string | undefined;
      
      // Check Authorization header (Bearer token)
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
      
      // Check X-Auth-Token header
      if (!token) {
        token = req.headers['x-auth-token'] as string;
      }
      
      if (!token) {
        return res.error('JWT token required', 401);
      }
      
      const payload = JWT.verify(token, secret);
      req.user = payload;
      next();
    } catch (error) {
      return res.error('Invalid or expired JWT token', 401);
    }
  };
}

// Middleware to require specific roles
export function requireRole(role: string | string[]): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  const roles = Array.isArray(role) ? role : [role];
  
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.error('Authentication required', 401);
    }
    
    const userRoles = req.user?.roles || [];
    const hasRole = roles.some(r => userRoles.includes(r));
    
    if (!hasRole) {
      return res.error('Insufficient permissions', 403);
    }
    
    next();
  };
}

// Password hashing utilities (integrates with built-in crypto)
export class PasswordUtils {
  static hash(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }
  
  static verify(password: string, hashedPassword: string): boolean {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }
}

// User management that integrates with Kenx database
export class UserManager {
  private db: any;
  private User: any;
  
  constructor(db: any) {
    this.db = db;
    this.initializeUserModel();
  }
  
  private initializeUserModel() {
    // Define User model in the built-in database
    this.User = this.db.define('User', {
      id: { type: 'string', primary: true, default: () => crypto.randomUUID() },
      email: { type: 'string', unique: true, required: true },
      password: { type: 'string', required: true },
      username: { type: 'string', unique: true },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      roles: { type: 'array', default: ['user'] },
      isActive: { type: 'boolean', default: true },
      lastLogin: { type: 'date' },
      createdAt: { type: 'date', default: () => new Date() },
      updatedAt: { type: 'date', default: () => new Date() }
    });
  }
  
  async createUser(userData: {
    email: string;
    password: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    roles?: string[];
  }) {
    // Check if user already exists
    const existingUser = await this.User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Hash password
    const hashedPassword = PasswordUtils.hash(userData.password);
    
    // Create user
    const user = await this.User.create({
      ...userData,
      password: hashedPassword,
      username: userData.username || userData.email.split('@')[0]
    });
    
    // Remove password from returned user
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  
  async authenticateUser(email: string, password: string) {
    const user = await this.User.findOne({ email, isActive: true });
    if (!user) {
      return null;
    }
    
    if (!PasswordUtils.verify(password, user.password)) {
      return null;
    }
    
    // Update last login
    await this.User.update({ id: user.id }, { lastLogin: new Date() });
    
    // Remove password from returned user
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  
  async findUserById(id: string) {
    const user = await this.User.findOne({ id, isActive: true });
    
    if (!user) return null;
    
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  
  async updateUser(id: string, updates: any) {
    // Hash password if it's being updated
    if (updates.password) {
      updates.password = PasswordUtils.hash(updates.password);
    }
    
    updates.updatedAt = new Date();
    
    const user = await this.User.update({ id }, updates);
    if (user && user.password) {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    
    return user;
  }
}

// Session management middleware
export function sessionManager(): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    // Clean up expired sessions
    const now = Date.now();
    
    // This would be handled by the Kenx instance in a real implementation
    // For now, we'll just proceed
    next();
  };
}

// CSRF protection middleware
export function csrfProtection(): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      // Generate CSRF token for safe methods
      const token = crypto.randomBytes(32).toString('hex');
      req.context.metadata.csrfToken = token;
      
      // Add CSRF token to response for templates to use
      if (req.session) {
        req.session.csrfToken = token;
      }
      
      return next();
    }
    
    // Verify CSRF token for unsafe methods
    const token = req.body?.csrfToken || req.headers['x-csrf-token'];
    const sessionToken = req.session?.csrfToken;
    
    if (!token || !sessionToken || token !== sessionToken) {
      return res.error('CSRF token mismatch', 403);
    }
    
    next();
  };
}

// Rate limiting for auth endpoints
export function authRateLimit(): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  const attempts = new Map<string, { count: number; resetTime: number }>();
  
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    const ip = req.headers['x-forwarded-for'] as string || 'unknown';
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 5;
    
    const userAttempts = attempts.get(ip);
    
    if (!userAttempts || now > userAttempts.resetTime) {
      attempts.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (userAttempts.count >= maxAttempts) {
      return res.error('Too many authentication attempts. Please try again later.', 429);
    }
    
    userAttempts.count++;
    next();
  };
}

export default {
  auth,
  requireRole,
  PasswordUtils,
  UserManager,
  sessionManager,
  csrfProtection,
  authRateLimit
};

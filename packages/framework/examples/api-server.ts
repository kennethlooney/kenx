import { 
  Kenx, 
  jwtAuth, 
  JWT, 
  UserManager, 
  PasswordUtils,
  KenxRequest, 
  KenxResponse,
  json,
  urlencoded,
  cors,
  logger,
  rateLimit,
  securityHeaders,
  compress,
  timeout,
  requestId,
  healthCheck,
  requireRole
} from '../src';

/**
 * Kenx API Server - Pure Backend
 * 
 * This is a headless Kenx server that provides only API endpoints.
 * Perfect for deploying to VPS, AWS, Google Cloud, etc.
 * Frontend can be deployed separately to static hosting.
 */

// API-only Kenx configuration
const apiServer = new Kenx({
  port: process.env.PORT ? parseInt(process.env.PORT) : 4000,
  database: {
    type: process.env.DB_TYPE as any || 'memory',
    path: process.env.DB_PATH || './data/kenx.db'
  },
  auth: {
    enabled: true,
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    sessionSecret: process.env.SESSION_SECRET || 'your-session-secret-key',
    sessionExpiry: 24 * 60 * 60 * 1000
  }
});

// Initialize user manager
const userManager = new UserManager(apiServer.db);

// ==== MIDDLEWARE STACK ====

// Security headers with API-friendly settings
apiServer.use(securityHeaders({
  contentSecurityPolicy: "default-src 'none'", // API doesn't serve HTML
  hsts: true,
  noSniff: true,
  frameOptions: 'DENY',
  xssProtection: true
}));

// CORS configuration for cross-origin frontend
apiServer.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:5173', // Vite dev server
    'https://your-frontend-domain.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Request-ID',
    'X-API-Key'
  ],
  credentials: true
}));

// Request tracing
apiServer.use(requestId());

// Compression for API responses
apiServer.use(compress());

// Timeout protection
apiServer.use(timeout(30000));

// Health check endpoint
apiServer.use(healthCheck('/health'));

// API logging
apiServer.use(logger('combined'));

// Rate limiting for API
apiServer.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1000 : 100,
  message: 'API rate limit exceeded'
}));

// Body parsing
apiServer.use(json());
apiServer.use(urlencoded());

// API versioning middleware
apiServer.use((req: KenxRequest, res: KenxResponse, next: any) => {
  // Add API version header
  res.setHeader('X-API-Version', '1.0.0');
  
  // Ensure all responses are JSON
  const originalSend = res.send;
  res.send = function(data: any) {
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json');
    }
    return originalSend.call(this, data);
  };
  
  next();
});

// ==== API ROUTES ====

// API Info endpoint
apiServer.get('/api', (req: KenxRequest, res: KenxResponse) => {
  return res.json({
    name: 'Kenx API Server',
    version: '1.0.0',
    description: 'Headless Kenx backend API',
    documentation: '/api/docs',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh',
        me: 'GET /api/auth/me'
      },
      users: {
        profile: 'GET /api/users/profile',
        updateProfile: 'PUT /api/users/profile'
      },
      health: 'GET /health'
    },
    requestId: req.context.requestId
  });
});

// API Documentation endpoint
apiServer.get('/api/docs', (req: KenxRequest, res: KenxResponse) => {
  return res.json({
    openapi: '3.0.0',
    info: {
      title: 'Kenx API',
      version: '1.0.0',
      description: 'Kenx Framework REST API'
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:4000',
        description: 'Kenx API Server'
      }
    ],
    paths: {
      '/api/auth/register': {
        post: {
          summary: 'Register new user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password', 'firstName'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'User created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      token: { type: 'string' },
                      user: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
});

// ==== AUTHENTICATION API ====

// User registration
apiServer.post('/api/auth/register', async (req: KenxRequest, res: KenxResponse) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    // Validation
    if (!email || !password || !firstName) {
      return res.error('Email, password, and first name are required', 400);
    }
    
    if (password.length < 8) {
      return res.error('Password must be at least 8 characters long', 400);
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.error('Invalid email format', 400);
    }
    
    // Create user
    const user = await userManager.createUser({
      email,
      password,
      firstName,
      lastName,
      roles: ['user']
    });
    
    // Generate JWT token
    const token = JWT.create(
      { 
        id: user.id, 
        email: user.email, 
        roles: user.roles,
        firstName: user.firstName,
        lastName: user.lastName
      },
      apiServer.config.auth!.jwtSecret!,
      '7d'
    );
    
    res.status(201);
    return res.json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles
      },
      requestId: req.context.requestId
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    
    if ((error as any).message?.includes('already exists')) {
      return res.error('User with this email already exists', 409);
    }
    
    return res.error('Registration failed', 500);
  }
});

// User login
apiServer.post('/api/auth/login', async (req: KenxRequest, res: KenxResponse) => {
  try {
    const { email, password, rememberMe } = req.body;
    
    if (!email || !password) {
      return res.error('Email and password are required', 400);
    }
    
    // Authenticate user
    const user = await userManager.authenticateUser(email, password);
    if (!user) {
      return res.error('Invalid credentials', 401);
    }
    
    // Generate JWT token
    const tokenExpiry = rememberMe ? '30d' : '7d';
    const token = JWT.create(
      { 
        id: user.id, 
        email: user.email, 
        roles: user.roles,
        firstName: user.firstName,
        lastName: user.lastName
      },
      apiServer.config.auth!.jwtSecret!,
      tokenExpiry
    );
    
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      expiresIn: tokenExpiry,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles
      },
      requestId: req.context.requestId
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.error('Login failed', 500);
  }
});

// Get current user info
apiServer.get('/api/auth/me', jwtAuth(apiServer.config.auth!.jwtSecret!), (req: KenxRequest, res: KenxResponse) => {
  return res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      roles: req.user.roles
    },
    requestId: req.context.requestId
  });
});

// Logout (client-side token removal, but we can blacklist on server-side)
apiServer.post('/api/auth/logout', jwtAuth(apiServer.config.auth!.jwtSecret!), (req: KenxRequest, res: KenxResponse) => {
  // In a production app, you might want to blacklist the token
  // For now, we'll just return success (client should remove token)
  return res.json({
    success: true,
    message: 'Logged out successfully',
    requestId: req.context.requestId
  });
});

// Token refresh
apiServer.post('/api/auth/refresh', jwtAuth(apiServer.config.auth!.jwtSecret!), (req: KenxRequest, res: KenxResponse) => {
  try {
    // Generate new token
    const newToken = JWT.create(
      { 
        id: req.user.id, 
        email: req.user.email, 
        roles: req.user.roles,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      apiServer.config.auth!.jwtSecret!,
      '7d'
    );
    
    return res.json({
      success: true,
      message: 'Token refreshed successfully',
      token: newToken,
      expiresIn: '7d',
      requestId: req.context.requestId
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.error('Token refresh failed', 500);
  }
});

// ==== USER MANAGEMENT API ====

// Get user profile
apiServer.get('/api/users/profile', jwtAuth(apiServer.config.auth!.jwtSecret!), (req: KenxRequest, res: KenxResponse) => {
  return res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      roles: req.user.roles
    },
    requestId: req.context.requestId
  });
});

// Update user profile
apiServer.put('/api/users/profile', jwtAuth(apiServer.config.auth!.jwtSecret!), async (req: KenxRequest, res: KenxResponse) => {
  try {
    const { firstName, lastName } = req.body;
    
    if (!firstName) {
      return res.error('First name is required', 400);
    }
    
    const updatedUser = await userManager.updateUser(req.user.id, { 
      firstName, 
      lastName 
    });
    
    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
      requestId: req.context.requestId
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    return res.error('Failed to update profile', 500);
  }
});

// ==== ADMIN API (Role-based) ====

// Admin-only endpoint example
apiServer.get('/api/admin/users', 
  jwtAuth(apiServer.config.auth!.jwtSecret!),
  requireRole('admin'),
  (req: KenxRequest, res: KenxResponse) => {
    return res.json({
      success: true,
      message: 'Admin access granted',
      users: [], // In real app, fetch users from database
      requestId: req.context.requestId
    });
  }
);

// ==== ERROR HANDLING ====

// 404 handler for API routes
apiServer.use((req: KenxRequest, res: KenxResponse, next: any) => {
  if (req.url?.startsWith('/api/')) {
    return res.error('API endpoint not found', 404);
  }
  next();
});

// Global error handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  apiServer.close(() => {
    console.log('Process terminated');
  });
});

// Start API server
apiServer.start(() => {
  console.log('🚀 Kenx API Server running on port', process.env.PORT || 4000);
  console.log('');
  console.log('📡 API Endpoints:');
  console.log('  - GET  /api (API info)');
  console.log('  - GET  /api/docs (OpenAPI documentation)');
  console.log('  - GET  /health (health check)');
  console.log('  - POST /api/auth/register (register user)');
  console.log('  - POST /api/auth/login (login user)');
  console.log('  - GET  /api/auth/me (current user)');
  console.log('  - POST /api/auth/refresh (refresh token)');
  console.log('  - GET  /api/users/profile (user profile)');
  console.log('  - PUT  /api/users/profile (update profile)');
  console.log('');
  console.log('🌐 CORS Origins:', process.env.CORS_ORIGINS || 'localhost:3000,localhost:3001,localhost:5173');
  console.log('🔒 JWT Secret:', process.env.JWT_SECRET ? '***configured***' : '***using default***');
  console.log('💾 Database:', process.env.DB_TYPE || 'memory');
  console.log('');
  console.log('🔧 Environment Variables:');
  console.log('  - PORT: API server port');
  console.log('  - JWT_SECRET: JWT signing secret');
  console.log('  - CORS_ORIGINS: Comma-separated allowed origins');
  console.log('  - DB_TYPE: Database type (memory, json)');
  console.log('  - DB_PATH: Database file path');
  console.log('  - NODE_ENV: Environment (development, production)');
});

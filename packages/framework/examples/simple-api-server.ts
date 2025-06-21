/**
 * Simple Kenx API Server Example
 * 
 * This demonstrates a clean separation between frontend and backend.
 * The backend runs as a pure API server that can be deployed separately.
 */

import kenx, { 
  KenxRequest, 
  KenxResponse, 
  json, 
  cors, 
  logger,
  auth,
  jwtAuth,
  UserManager
} from '../src';

// Create API-only server (no views, no static files)
const app = kenx({
  port: 4000,
  database: {
    type: 'memory' // In production, use 'json' with a file path
  },
  auth: {
    enabled: true,
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production',
    sessionSecret: 'session-secret',
    sessionExpiry: 24 * 60 * 60 * 1000 // 24 hours
  }
});

// Initialize user manager
const userManager = new UserManager(app.db);

// CORS for frontend apps (static hosting)
app.use(cors({
  origin: [
    'http://localhost:3000',      // React dev server
    'http://localhost:5173',      // Vite dev server  
    'http://localhost:8080',      // Vue dev server
    'https://myapp.netlify.app',  // Netlify
    'https://myapp.vercel.app',   // Vercel
    'https://mydomain.com'        // Custom domain
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));

// Middleware stack
app.use(logger());
app.use(json());

// Parse form data
app.use((req: KenxRequest, res: KenxResponse, next: any) => {
  if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      req.body = Object.fromEntries(new URLSearchParams(body));
      next();
    });
  } else {
    next();
  }
});

// =============================================
// API ROUTES
// =============================================

// API Information
app.get('/api', (req: KenxRequest, res: KenxResponse) => {
  res.json({
    name: 'Kenx API Server',
    version: '1.0.0',
    description: 'Backend API built with Kenx Framework',
    documentation: '/api/docs',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        profile: 'GET /api/auth/profile (requires JWT)'
      },
      posts: {
        list: 'GET /api/posts',
        get: 'GET /api/posts/:id',
        create: 'POST /api/posts (requires JWT)',
        update: 'PUT /api/posts/:id (requires JWT)',
        delete: 'DELETE /api/posts/:id (requires JWT)'
      }
    }
  });
});

// Health Check
app.get('/api/health', (req: KenxRequest, res: KenxResponse) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: !!app.db,
    version: '1.0.0'
  });
});

// =============================================
// AUTHENTICATION
// =============================================

// Register
app.post('/api/auth/register', async (req: KenxRequest, res: KenxResponse) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    const user = await userManager.createUser({
      email,
      password,
      firstName: username,
      roles: ['user']
    });

    const jwtSecret = app.config.auth?.jwtSecret;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'JWT not configured'
      });
    }

    // Create JWT token (simplified - would use proper JWT library in production)
    const token = Buffer.from(JSON.stringify({
      userId: user.id,
      email: user.email,
      roles: user.roles,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    })).toString('base64');

    res.json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          username: user.firstName,
          email: user.email,
          roles: user.roles
        },
        token,
        expiresIn: '24h'
      }
    });

  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
});

// Login
app.post('/api/auth/login', async (req: KenxRequest, res: KenxResponse) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const user = await userManager.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const jwtSecret = app.config.auth?.jwtSecret;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'JWT not configured'
      });
    }

    // Create JWT token (simplified)
    const token = Buffer.from(JSON.stringify({
      userId: user.id,
      email: user.email,
      roles: user.roles,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    })).toString('base64');

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.firstName,
          email: user.email,
          roles: user.roles
        },
        token,
        expiresIn: '24h'
      }
    });

  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: error.message || 'Login failed'
    });
  }
});

// Get Profile (requires authentication)
app.get('/api/auth/profile', async (req: KenxRequest, res: KenxResponse) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authorization token required'
    });
  }

  try {
    const token = authHeader.substring(7); // Remove 'Bearer '
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Check if token is expired
    if (decoded.exp < Date.now()) {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }    const user = await userManager.findUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.firstName,
        email: user.email,
        roles: user.roles
      }
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// =============================================
// POSTS API
// =============================================

// Initialize Posts model
if (app.db) {
  const Post = app.model('posts', {
    title: { type: 'string', required: true },
    content: { type: 'string', required: true },
    authorId: { type: 'number', required: true },
    published: { type: 'boolean', default: true },
    tags: { type: 'array', default: [] },
    createdAt: { type: 'date', default: () => new Date() }
  });

  // Get Posts
  app.get('/api/posts', (req: KenxRequest, res: KenxResponse) => {
    const page = parseInt(req.query?.page as string) || 1;
    const limit = parseInt(req.query?.limit as string) || 10;
    const offset = (page - 1) * limit;

    const posts = app.db!.findAll('posts', {
      where: { published: true },
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit,
      offset
    });

    const total = app.db!.findAll('posts', { where: { published: true } }).length;

    res.json({
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  });

  // Get Single Post
  app.get('/api/posts/:id', (req: KenxRequest, res: KenxResponse) => {
    const postId = parseInt(req.params!.id);
    const post = app.db!.findById('posts', postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    res.json({
      success: true,
      data: post
    });
  });

  // Create Post (with simple auth check)
  app.post('/api/posts', async (req: KenxRequest, res: KenxResponse) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      });
    }

    try {
      const token = authHeader.substring(7);
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
      if (decoded.exp < Date.now()) {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }

      const { title, content, tags, published } = req.body;

      if (!title || !content) {
        return res.status(400).json({
          success: false,
          message: 'Title and content are required'
        });
      }

      const post = app.db!.insert('posts', {
        title,
        content,
        authorId: decoded.userId,
        published: published !== false,
        tags: tags || []
      });

      res.status(201).json({
        success: true,
        message: 'Post created successfully',
        data: post
      });

    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  });

  // Seed some data
  setTimeout(() => {
    const users = app.db!.findAll('users');
    if (users.length === 0) {
      // Create sample users
      userManager.createUser({
        email: 'admin@example.com',
        password: 'admin123',
        firstName: 'admin',
        roles: ['admin']
      });

      userManager.createUser({
        email: 'user@example.com',  
        password: 'user123',
        firstName: 'user',
        roles: ['user']
      });

      console.log('✅ Sample users created');
      console.log('   - admin@example.com / admin123');
      console.log('   - user@example.com / user123');
    }

    const posts = app.db!.findAll('posts');
    if (posts.length === 0) {
      app.db!.insert('posts', {
        title: 'Welcome to Kenx API',
        content: 'This is a decoupled Kenx API server. Frontend can be deployed separately to static hosting.',
        authorId: 1,
        published: true,
        tags: ['kenx', 'api', 'backend']
      });

      app.db!.insert('posts', {
        title: 'Building Modern Web Apps',
        content: 'Learn how to build scalable applications with separate frontend and backend deployments.',
        authorId: 1,
        published: true,
        tags: ['architecture', 'microservices', 'deployment']
      });

      console.log('✅ Sample posts created');
    }
  }, 1000);
}

// Start server
app.start(() => {
  console.log('🚀 Kenx API Server running on port 4000');
  console.log('');
  console.log('📊 API Endpoints:');
  console.log('  GET  /api              - API information');
  console.log('  GET  /api/health       - Health check'); 
  console.log('  POST /api/auth/login   - User login');
  console.log('  POST /api/auth/register - User registration');
  console.log('  GET  /api/auth/profile - Get profile (auth required)');
  console.log('  GET  /api/posts        - List posts');
  console.log('  GET  /api/posts/:id    - Get single post');
  console.log('  POST /api/posts        - Create post (auth required)');
  console.log('');
  console.log('🌐 CORS enabled for:');
  console.log('  - http://localhost:3000 (React)');
  console.log('  - http://localhost:5173 (Vite)');
  console.log('  - https://*.netlify.app');
  console.log('  - https://*.vercel.app');
  console.log('');
  console.log('🔐 Test Authentication:');
  console.log('  curl -X POST http://localhost:4000/api/auth/login \\');
  console.log('       -H "Content-Type: application/json" \\');
  console.log('       -d \'{"username":"admin@example.com","password":"admin123"}\'');
});

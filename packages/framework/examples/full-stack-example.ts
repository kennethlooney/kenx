import { 
  Kenx, 
  auth, 
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
  healthCheck
} from '../src';

// Initialize Kenx with full configuration
const app = new Kenx({
  port: 3002,
  database: {
    type: 'memory'
  },
  auth: {
    enabled: true,
    jwtSecret: 'your-super-secret-jwt-key-change-in-production',
    sessionSecret: 'your-session-secret-key',
    sessionExpiry: 24 * 60 * 60 * 1000
  },  views: {
    viewsDir: './views',
    engine: 'kenx'
  },
  static: {
    directory: './public',
    prefix: '/static'
  },
  websocket: {
    enabled: true,
    path: '/ws'
  }
});

// Initialize user manager
const userManager = new UserManager(app.db);

// ==== GLOBAL MIDDLEWARE ====

// Security headers
app.use(securityHeaders({
  contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  hsts: true,
  noSniff: true,
  frameOptions: 'DENY',
  xssProtection: true
}));

// Request ID for tracing
app.use(requestId());

// Compression
app.use(compress());

// Timeout (30 seconds)
app.use(timeout(30000));

// Health check
app.use(healthCheck('/health'));

// CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true
}));

// Request logging
app.use(logger('combined'));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
}));

// Body parsing
app.use(json());
app.use(urlencoded());

// ==== AUTHENTICATION ROUTES ====

// Registration with enhanced validation
app.post('/auth/register', async (req: KenxRequest, res: KenxResponse) => {
  try {
    const { email, password, firstName, lastName, platform } = req.body;
    
    // Enhanced validation
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
    
    // Platform-specific response
    const isMobileOrAPI = platform === 'mobile' || 
                         req.headers['user-agent']?.includes('Mobile') ||
                         req.headers.accept?.includes('application/json');
    
    if (isMobileOrAPI) {
      const token = JWT.create(
        { 
          id: user.id, 
          email: user.email, 
          roles: user.roles,
          firstName: user.firstName,
          lastName: user.lastName
        },
        app.config.auth!.jwtSecret!,
        '7d'
      );
      
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
        }
      });
    } else {
      await req.login(user);
      return res.json({
        success: true,
        message: 'User registered successfully',
        redirectTo: '/dashboard'
      });
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    
    if ((error as any).message?.includes('already exists')) {
      return res.error('User with this email already exists', 409);
    }
    
    return res.error('Registration failed', 500);
  }
});

// Login with enhanced security
app.post('/auth/login', async (req: KenxRequest, res: KenxResponse) => {
  try {
    const { email, password, platform, rememberMe } = req.body;
    
    if (!email || !password) {
      return res.error('Email and password are required', 400);
    }
    
    // Authenticate user
    const user = await userManager.authenticateUser(email, password);
    if (!user) {
      return res.error('Invalid credentials', 401);
    }
    
    // Platform-specific response
    const isMobileOrAPI = platform === 'mobile' || 
                         req.headers['user-agent']?.includes('Mobile') ||
                         req.headers.accept?.includes('application/json');
    
    if (isMobileOrAPI) {
      // JWT token with longer expiry if remember me is checked
      const tokenExpiry = rememberMe ? '30d' : '7d';
      
      const token = JWT.create(
        { 
          id: user.id, 
          email: user.email, 
          roles: user.roles,
          firstName: user.firstName,
          lastName: user.lastName
        },
        app.config.auth!.jwtSecret!,
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
        }
      });
    } else {
      await req.login(user);
      
      // Set JWT cookie for hybrid auth
      const token = JWT.create(
        { 
          id: user.id, 
          email: user.email, 
          roles: user.roles 
        },
        app.config.auth!.jwtSecret!,
        '24h'
      );
      
      const cookieOptions = rememberMe 
        ? 'HttpOnly; Path=/; Max-Age=2592000; SameSite=Strict' // 30 days
        : 'HttpOnly; Path=/; Max-Age=86400; SameSite=Strict';  // 1 day
      
      res.setHeader('Set-Cookie', `jwt=${token}; ${cookieOptions}`);
      
      return res.json({
        success: true,
        message: 'Login successful',
        redirectTo: '/dashboard'
      });
    }
    
  } catch (error) {
    console.error('Login error:', error);
    return res.error('Login failed', 500);
  }
});

// Enhanced logout
app.post('/auth/logout', async (req: KenxRequest, res: KenxResponse) => {
  try {
    await req.logout();
    
    // Clear JWT cookie
    res.setHeader('Set-Cookie', 'jwt=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict');
    
    if (req.headers.accept?.includes('text/html')) {
      return res.json({
        success: true,
        message: 'Logged out successfully',
        redirectTo: '/'
      });
    } else {
      return res.json({
        success: true,
        message: 'Logged out successfully'
      });
    }
    
  } catch (error) {
    console.error('Logout error:', error);
    return res.error('Logout failed', 500);
  }
});

// ==== PROTECTED ROUTES ====

// Dashboard with hybrid auth
app.get('/dashboard', auth({
  jwt: {
    secret: app.config.auth!.jwtSecret!,
    cookieName: 'jwt'
  },
  session: true,
  redirectTo: '/login'
}), (req: KenxRequest, res: KenxResponse) => {
  const user = req.user || req.session?.user;
  
  if (req.headers.accept?.includes('application/json')) {
    return res.json({
      success: true,
      message: 'Welcome to your dashboard',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles
      },
      requestId: req.context.requestId
    });
  } else {
    return res.json({
      html: `
        <h1>Dashboard</h1>
        <p>Welcome, ${user.firstName || user.email}!</p>
        <p>Your roles: ${user.roles?.join(', ') || 'user'}</p>
        <p>Request ID: ${req.context.requestId}</p>
        <a href="/logout">Logout</a>
      `
    });
  }
});

// ==== API ROUTES (JWT Only) ====

// Profile management
app.get('/api/profile', jwtAuth(app.config.auth!.jwtSecret!), (req: KenxRequest, res: KenxResponse) => {
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

app.put('/api/profile', jwtAuth(app.config.auth!.jwtSecret!), async (req: KenxRequest, res: KenxResponse) => {
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

// Token refresh with security checks
app.post('/api/auth/refresh', jwtAuth(app.config.auth!.jwtSecret!), (req: KenxRequest, res: KenxResponse) => {
  try {
    // Create new token with fresh expiration
    const newToken = JWT.create(
      { 
        id: req.user.id, 
        email: req.user.email, 
        roles: req.user.roles,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      app.config.auth!.jwtSecret!,
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

// ==== PUBLIC ROUTES ====

// Home page
app.get('/', (req: KenxRequest, res: KenxResponse) => {
  return res.json({
    html: `
      <h1>Welcome to Kenx Framework</h1>
      <p>A modern, full-stack Node.js framework</p>
      <p>Authentication status: ${req.isAuthenticated() ? 'Logged in' : 'Not logged in'}</p>
      <p>Request ID: ${req.context.requestId}</p>
      ${req.isAuthenticated() 
        ? '<a href="/dashboard">Go to Dashboard</a>' 
        : '<a href="/login">Login</a> | <a href="/register">Register</a>'
      }
      <hr>
      <h3>API Endpoints</h3>
      <ul>
        <li>GET /health - Health check</li>
        <li>POST /auth/register - Register user</li>
        <li>POST /auth/login - Login user</li>
        <li>GET /api/profile - Get profile (JWT required)</li>
        <li>PUT /api/profile - Update profile (JWT required)</li>
        <li>POST /api/auth/refresh - Refresh token (JWT required)</li>
      </ul>
    `
  });
});

// Login page
app.get('/login', (req: KenxRequest, res: KenxResponse) => {
  if (req.isAuthenticated()) {
    return res.json({
      success: true,
      redirectTo: '/dashboard'
    });
  }
  
  return res.json({
    html: `
      <h1>Login</h1>
      <form method="POST" action="/auth/login">
        <div>
          <label>Email: <input type="email" name="email" required></label>
        </div>
        <div>
          <label>Password: <input type="password" name="password" required></label>
        </div>
        <div>
          <label><input type="checkbox" name="rememberMe"> Remember me</label>
        </div>
        <button type="submit">Login</button>
      </form>
      <p><a href="/register">Need an account? Register here</a></p>
      <p>Request ID: ${req.context.requestId}</p>
    `
  });
});

// Registration page
app.get('/register', (req: KenxRequest, res: KenxResponse) => {
  if (req.isAuthenticated()) {
    return res.json({
      success: true,
      redirectTo: '/dashboard'
    });
  }
  
  return res.json({
    html: `
      <h1>Register</h1>
      <form method="POST" action="/auth/register">
        <div>
          <label>Email: <input type="email" name="email" required></label>
        </div>
        <div>
          <label>Password: <input type="password" name="password" required minlength="8"></label>
        </div>
        <div>
          <label>First Name: <input type="text" name="firstName" required></label>
        </div>
        <div>
          <label>Last Name: <input type="text" name="lastName"></label>
        </div>
        <button type="submit">Register</button>
      </form>
      <p><a href="/login">Already have an account? Login here</a></p>
      <p>Request ID: ${req.context.requestId}</p>
    `
  });
});

// Start server
app.start(() => {
  console.log('🚀 Enhanced Kenx server running on http://localhost:3002');
  console.log('');
  console.log('🔒 Security features enabled:');
  console.log('  - Security headers');
  console.log('  - Request ID tracing');
  console.log('  - Compression');
  console.log('  - Timeout protection');
  console.log('  - CORS protection');
  console.log('  - Rate limiting');
  console.log('  - JWT + Session authentication');
  console.log('');
  console.log('📱 Endpoints:');
  console.log('  - GET  /health (health check)');
  console.log('  - GET  / (home page)');
  console.log('  - GET  /login (login form)');
  console.log('  - POST /auth/login (authenticate)');
  console.log('  - GET  /dashboard (protected page)');
  console.log('  - GET  /api/profile (JWT-protected API)');
  console.log('  - PUT  /api/profile (update profile)');
  console.log('  - POST /api/auth/refresh (refresh token)');
  console.log('');
  console.log('🧪 Test with:');
  console.log('  curl http://localhost:3002/health');
  console.log('  curl -X POST http://localhost:3002/auth/register \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"email":"test@example.com","password":"password123","firstName":"John","platform":"mobile"}\'');
});

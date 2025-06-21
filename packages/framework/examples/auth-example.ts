import { Kenx, auth, jwtAuth, JWT, UserManager, PasswordUtils, KenxRequest, KenxResponse } from '../src';

const app = new Kenx({
  port: 3001,
  database: {
    type: 'memory' // Use in-memory database for this example
  },
  auth: {
    enabled: true,
    jwtSecret: 'your-super-secret-jwt-key-change-in-production',
    sessionSecret: 'your-session-secret-key',
    sessionExpiry: 24 * 60 * 60 * 1000 // 24 hours
  }
});

// Initialize user manager with the built-in database
const userManager = new UserManager(app.db);

// Add JSON and URL-encoded middleware
app.use((req, res, next) => {
  if (req.headers['content-type']?.includes('application/json')) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        req.body = JSON.parse(body);
        next();
      } catch (error) {
        return res.error('Invalid JSON', 400);
      }
    });
  } else if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const params = new URLSearchParams(body);
      req.body = Object.fromEntries(params);
      next();
    });
  } else {
    next();
  }
});

// ==== AUTHENTICATION ROUTES ====

// Login endpoint that works for both web and mobile
app.post('/auth/login', async (req: KenxRequest, res: KenxResponse) => {
  try {
    const { email, password, platform } = req.body;
    
    if (!email || !password) {
      return res.error('Email and password are required', 400);
    }
    
    // Authenticate user using UserManager
    const user = await userManager.authenticateUser(email, password);
    if (!user) {
      return res.error('Invalid credentials', 401);
    }
    
    // Get JWT secret with proper type checking
    const jwtSecret = app.config.auth?.jwtSecret;
    if (!jwtSecret) {
      return res.error('JWT not configured', 500);
    }
    
    // Determine if this is a mobile/API request
    const isMobileOrAPI = platform === 'mobile' || 
                         req.headers['user-agent']?.includes('Mobile') ||
                         req.headers.accept?.includes('application/json');
    
    if (isMobileOrAPI) {
      // For mobile/API: Return JWT token
      const token = JWT.create(
        { 
          id: user.id, 
          email: user.email, 
          roles: user.roles 
        },
        jwtSecret,
        '7d' // 7 days for mobile
      );
      
      return res.json({
        success: true,
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
      // For web: Use session and optionally set JWT cookie
      await req.login(user);
      
      // Optionally also set JWT cookie for hybrid auth
      const token = JWT.create(
        { 
          id: user.id, 
          email: user.email, 
          roles: user.roles 
        },
        jwtSecret,
        '24h'
      );
      
      res.setHeader('Set-Cookie', `jwt=${token}; HttpOnly; Path=/; Max-Age=86400`);
      
      // Redirect or return success
      if (req.headers.accept?.includes('text/html')) {
        res.status(302);
        res.setHeader('Location', '/dashboard');
        res.end();
      } else {
        return res.json({ success: true, redirectTo: '/dashboard' });
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.error('Internal server error', 500);
  }
});

// Register endpoint
app.post('/auth/register', async (req: KenxRequest, res: KenxResponse) => {
  try {
    const { email, password, firstName, lastName, platform } = req.body;
    
    if (!email || !password || !firstName) {
      return res.error('Email, password, and first name are required', 400);
    }
    
    // Create new user using UserManager
    const user = await userManager.createUser({
      email,
      password,
      firstName,
      lastName,
      roles: ['user']
    });
    
    // Get JWT secret with proper type checking
    const jwtSecret = app.config.auth?.jwtSecret;
    if (!jwtSecret) {
      return res.error('JWT not configured', 500);
    }
    
    // Same login logic as above
    const isMobileOrAPI = platform === 'mobile' || 
                         req.headers['user-agent']?.includes('Mobile') ||
                         req.headers.accept?.includes('application/json');
    
    if (isMobileOrAPI) {
      const token = JWT.create(
        { 
          id: user.id, 
          email: user.email, 
          roles: user.roles 
        },
        jwtSecret,
        '7d'
      );
      
      return res.json({
        success: true,
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
      res.status(302);
      res.setHeader('Location', '/dashboard');
      res.end();
    }
  } catch (error) {
    console.error('Registration error:', error);
    if ((error as any).message?.includes('already exists')) {
      return res.error('User already exists', 409);
    }
    return res.error('Internal server error', 500);
  }
});

// Logout endpoint
app.post('/auth/logout', async (req: KenxRequest, res: KenxResponse) => {
  await req.logout();
  
  // Clear JWT cookie if present
  res.setHeader('Set-Cookie', 'jwt=; HttpOnly; Path=/; Max-Age=0');
  
  if (req.headers.accept?.includes('text/html')) {
    res.status(302);
    res.setHeader('Location', '/');
    res.end();
  } else {
    return res.json({ success: true });
  }
});

// ==== PROTECTED ROUTES ====

// Hybrid auth route (works with both sessions and JWT)
app.get('/dashboard', auth({
  jwt: {
    secret: app.config.auth?.jwtSecret || '',
    cookieName: 'jwt' // Also check JWT cookie
  },
  session: true, // Also check sessions
  redirectTo: '/login'
}), (req: KenxRequest, res: KenxResponse) => {
  const user = req.user || req.session?.user;
  
  if (req.headers.accept?.includes('application/json')) {
    // API response
    return res.json({
      message: 'Welcome to your dashboard',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } else {
    // Web response
    return res.json({
      html: `
        <h1>Dashboard</h1>
        <p>Welcome, ${user.firstName || user.email}!</p>
        <p>Your roles: ${user.roles?.join(', ') || 'user'}</p>
        <a href="/logout">Logout</a>
      `
    });
  }
});

// Pure API routes (JWT only)
app.get('/api/profile', jwtAuth(app.config.auth?.jwtSecret || ''), (req: KenxRequest, res: KenxResponse) => {
  return res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      roles: req.user.roles
    }
  });
});

app.put('/api/profile', jwtAuth(app.config.auth?.jwtSecret || ''), async (req: KenxRequest, res: KenxResponse) => {
  try {
    const { firstName, lastName } = req.body;
    const userId = req.user.id;
    
    const updatedUser = await userManager.updateUser(userId, { firstName, lastName });
    
    return res.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName
      }
    });
  } catch (error) {
    return res.error('Failed to update profile', 500);
  }
});

// Token refresh endpoint for mobile apps
app.post('/api/auth/refresh', jwtAuth(app.config.auth?.jwtSecret || ''), (req: KenxRequest, res: KenxResponse) => {
  const jwtSecret = app.config.auth?.jwtSecret;
  if (!jwtSecret) {
    return res.error('JWT not configured', 500);
  }
  
  // Create a new token with updated expiration
  const newToken = JWT.create(
    { 
      id: req.user.id, 
      email: req.user.email, 
      roles: req.user.roles 
    },
    jwtSecret,
    '7d'
  );
  
  return res.json({
    success: true,
    token: newToken
  });
});

// ==== PUBLIC ROUTES ====

app.get('/', (req: KenxRequest, res: KenxResponse) => {
  return res.json({
    html: `
      <h1>Welcome to Kenx Authentication Demo</h1>
      <p>Authentication status: ${req.isAuthenticated() ? 'Logged in' : 'Not logged in'}</p>
      ${req.isAuthenticated() 
        ? '<a href="/dashboard">Go to Dashboard</a>' 
        : '<a href="/login">Login</a> | <a href="/register">Register</a>'
      }
    `
  });
});

app.get('/login', (req: KenxRequest, res: KenxResponse) => {
  if (req.isAuthenticated()) {
    res.status(302);
    res.setHeader('Location', '/dashboard');
    return res.end();
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
        <button type="submit">Login</button>
      </form>
      <p><a href="/register">Need an account? Register here</a></p>
    `
  });
});

app.get('/register', (req: KenxRequest, res: KenxResponse) => {
  if (req.isAuthenticated()) {
    res.status(302);
    res.setHeader('Location', '/dashboard');
    return res.end();
  }
  
  return res.json({
    html: `
      <h1>Register</h1>
      <form method="POST" action="/auth/register">
        <div>
          <label>Email: <input type="email" name="email" required></label>
        </div>
        <div>
          <label>Password: <input type="password" name="password" required></label>
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
    `
  });
});

app.start(() => {
  console.log('🚀 Server running on http://localhost:3001');
  console.log('📱 Mobile apps can authenticate using JWT tokens');
  console.log('🌐 Web apps can use sessions or hybrid auth');
  console.log('');
  console.log('Try these endpoints:');
  console.log('- GET  / (home page)');
  console.log('- GET  /login (login form)');
  console.log('- POST /auth/login (authenticate)');
  console.log('- GET  /dashboard (protected page)');
  console.log('- GET  /api/profile (JWT-protected API)');
});

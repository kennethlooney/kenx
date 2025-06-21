# 🚀 Kenx Framework - Migration Guide

> **Upgrading to Kenx v2.0** - Authentication, Security, and Frontend/Backend Separation

## 🎯 What's New in v2.0

### ✨ **Major New Features**
- 🔐 **Complete Authentication** - JWT, sessions, role-based access
- 🛡️ **Security Middleware** - CORS, CSRF, rate limiting, security headers  
- 🔗 **Frontend/Backend Separation** - API-only deployment support
- 📱 **Frontend Client Library** - TypeScript client for decoupled apps
- ⚡ **Enhanced Middleware** - Compression, timeout, request ID, health checks

### 🔄 **Breaking Changes**
- Authentication configuration moved to `auth` option in kenx config
- Some middleware imports changed (now from `@kenx/framework` directly)
- Database user model extended with authentication fields

## 🛠️ Migration Steps

### Step 1: Update Kenx Configuration

**Before (v1.x):**
```typescript
import kenx from '@kenx/framework';

const app = kenx({
  database: { type: 'json', path: './app.db' },
  views: { engine: 'kenx', viewsDir: './views' }
});
```

**After (v2.0):**
```typescript
import kenx from '@kenx/framework';

const app = kenx({
  database: { type: 'json', path: './app.db' },
  views: { engine: 'kenx', viewsDir: './views' },
  auth: { 
    enabled: true,  // Add authentication
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret',
    sessionSecret: process.env.SESSION_SECRET || 'your-session-secret'  
  }
});
```

### Step 2: Add Security Middleware

**Add to your app:**
```typescript
import { securityHeaders, cors, rateLimit } from '@kenx/framework';

// Add security middleware
app.use(securityHeaders());
app.use(cors({ origin: ['http://localhost:3000'] })); // Adjust origins
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

### Step 3: Update Database Models (If Using Custom Users)

**Before:**
```typescript
app.db.createModel('users', {
  username: { type: 'string', required: true },
  email: { type: 'string', required: true }
});
```

**After:**
```typescript
// The auth system creates users automatically, but you can extend:
app.db.createModel('users', {
  username: { type: 'string', required: true },
  email: { type: 'string', required: true },
  password: { type: 'string', required: true }, // Added by auth system
  roles: { type: 'array', default: ['user'] },   // Added by auth system
  createdAt: { type: 'date', default: Date.now }, // Added by auth system
  // Your custom fields:
  firstName: { type: 'string' },
  lastName: { type: 'string' }
});
```

### Step 4: Add Authentication Routes

**Add login/register routes:**
```typescript
// Register route
app.post('/register', async (req, res) => {
  try {
    const user = await app.auth.register({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password
    });
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login route  
app.post('/login', async (req, res) => {
  const result = await app.auth.login(req.body.username, req.body.password);
  if (result.success) {
    req.session.userId = result.user.id; // For session auth
    res.json({ token: result.token, user: result.user }); // For JWT auth
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});
```

### Step 5: Protect Existing Routes

**Before (no auth):**
```typescript
app.get('/dashboard', (req, res) => {
  res.render('dashboard', { user: 'Anonymous' });
});

app.get('/api/posts', (req, res) => {
  const posts = app.db.findAll('posts');
  res.json(posts);
});
```

**After (with auth):**
```typescript
import { sessionAuth, jwtAuth } from '@kenx/framework';

// Web route with session auth
app.get('/dashboard', sessionAuth(), (req, res) => {
  res.render('dashboard', { user: req.user });
});

// API route with JWT auth (for decoupled frontends)
app.get('/api/posts', jwtAuth('your-jwt-secret'), (req, res) => {
  const posts = app.db.findAll('posts');
  res.json(posts);
});

// Hybrid route (accepts both session and JWT)
app.get('/profile', [sessionAuth(), jwtAuth('your-jwt-secret')], (req, res) => {
  res.json({ user: req.user });
});
```

## 🎨 Frontend Migration Options

### Option 1: Keep Full-Stack (No Changes Needed)
If you're happy with server-side rendering, **no changes needed!** Your existing templates and routes will work exactly the same.

### Option 2: Migrate to API + Frontend Separation

**Create a new API server:**
```typescript
// api-server.ts
import kenx, { cors, json, jwtAuth } from '@kenx/framework';

const api = kenx({
  database: { type: 'json', path: './api.db' },
  auth: { enabled: true, jwtSecret: 'your-secret' }
});

api.use(cors({ origin: ['https://your-frontend.netlify.app'] }));
api.use(json());

// Migrate your existing API routes
api.get('/api/posts', jwtAuth('your-secret'), (req, res) => {
  const posts = api.db.findAll('posts');
  res.json({ success: true, data: posts });
});

api.listen(4000); // Different port from your main app
```

**Create a frontend client:**
```typescript
// frontend/src/api-client.ts
import { KenxClient } from '@kenx/framework/client';

export const client = new KenxClient({
  baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:4000'
});

// Login function
export async function login(credentials) {
  return await client.login(credentials);
}

// Get posts function  
export async function getPosts() {
  return await client.get('/api/posts');
}
```

## 🔧 Environment Variables

**Create `.env` file:**
```bash
# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
SESSION_SECRET=your-super-secret-session-key-here
PEPPER=additional-password-security-pepper

# Database
DATABASE_PATH=./data/app.db

# CORS Origins (for API mode)
ALLOWED_ORIGINS=https://yourapp.netlify.app,https://yourapp.vercel.app

# Optional: Rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
```

**Update your code to use environment variables:**
```typescript
const app = kenx({
  database: { type: 'json', path: process.env.DATABASE_PATH || './app.db' },
  auth: {
    enabled: true,
    jwtSecret: process.env.JWT_SECRET,
    sessionSecret: process.env.SESSION_SECRET,
    pepper: process.env.PEPPER
  }
});
```

## 📦 Package.json Updates

**Add new dependencies for development:**
```json
{
  "scripts": {
    "dev": "ts-node src/app.ts",
    "dev:api": "ts-node src/api-server.ts",
    "build": "tsc",
    "start": "node dist/app.js"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "nodemon": "^3.0.0"
  }
}
```

## 🚨 Security Checklist

After migration, ensure you have:

- [ ] **Environment variables** for all secrets
- [ ] **HTTPS** in production  
- [ ] **CORS** configured for your frontend domains
- [ ] **Rate limiting** on auth endpoints
- [ ] **Security headers** middleware
- [ ] **CSRF protection** for forms
- [ ] **Strong passwords** enforced
- [ ] **Session security** (httpOnly, secure, sameSite cookies)

## 🧪 Testing Your Migration

### Test Authentication
```typescript
// Test registration
const registerResponse = await fetch('/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'testuser',
    email: 'test@example.com',
    password: 'securepassword123'
  })
});

// Test login
const loginResponse = await fetch('/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'testuser',
    password: 'securepassword123'
  })
});

const { token } = await loginResponse.json();

// Test protected route
const protectedResponse = await fetch('/api/profile', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Test CORS (if using API mode)
```bash
# From your frontend domain
curl -H "Origin: https://your-frontend.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     https://your-api.com/api/posts
```

## 🎯 Migration Strategies

### 🐌 **Gradual Migration (Recommended)**
1. Add authentication to existing app
2. Secure existing routes gradually
3. Later extract API if needed

### ⚡ **Full Separation Migration**
1. Create new API server
2. Move all API routes to API server
3. Build new frontend connecting to API
4. Deploy frontend and API separately

### 🔄 **Hybrid Approach**
1. Keep existing full-stack app
2. Add API endpoints for mobile/external use
3. Use same authentication for both

## 🆘 Common Migration Issues

### Issue: "Cannot find module @kenx/framework/auth"
**Solution:** Update imports to use the main package:
```typescript
// OLD (wrong)
import { sessionAuth } from '@kenx/framework/auth';

// NEW (correct)  
import { sessionAuth } from '@kenx/framework';
```

### Issue: CORS errors in browser
**Solution:** Add CORS middleware with your frontend domain:
```typescript
import { cors } from '@kenx/framework';

app.use(cors({
  origin: ['http://localhost:3000', 'https://your-frontend.com'],
  credentials: true
}));
```

### Issue: Session not persisting
**Solution:** Ensure session configuration:
```typescript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

## 🎉 You're Done!

After migration, you'll have:
- ✅ **Secure authentication** with JWT and sessions
- ✅ **Production-ready security** middleware
- ✅ **Flexible deployment** options (monolithic or separated)
- ✅ **Future-proof architecture** ready for scaling

## 📚 Next Steps

- Check out the [Authentication Quick Reference](authentication-quick-reference.md)
- Read the [Frontend/Backend Separation Guide](frontend-backend-separation.md)
- Explore the [complete examples](../examples/)
- Star the project on GitHub! ⭐

---

**Need help with migration? Open an issue on GitHub!** 🚀

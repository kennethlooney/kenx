# 🔐 Kenx Authentication - Quick Reference

> **Complete Authentication System** - JWT, Sessions, Role-based Access, Security Middleware

## 🚀 Quick Setup

```typescript
import kenx, { sessionAuth, jwtAuth, hasRole } from '@kenx/framework';

const app = kenx({
  auth: { 
    enabled: true, 
    jwtSecret: 'your-jwt-secret',
    sessionSecret: 'your-session-secret'  
  }
});
```

## 📋 Authentication Methods

### 1. 🎫 JWT Authentication (Stateless)
**Perfect for APIs and mobile apps**

```typescript
// Protect route with JWT
app.get('/api/profile', jwtAuth('your-secret'), (req, res) => {
  res.json({ user: req.user });
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const result = await app.auth.login(req.body.username, req.body.password);
  if (result.success) {
    res.json({ token: result.token, user: result.user });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});
```

### 2. 🍪 Session Authentication (Traditional)
**Great for web applications**

```typescript
// Protect route with sessions
app.get('/dashboard', sessionAuth(), (req, res) => {
  res.render('dashboard', { user: req.user });
});

// Login page
app.post('/login', async (req, res) => {
  const result = await app.auth.login(req.body.username, req.body.password);
  if (result.success) {
    req.session.userId = result.user.id;
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: 'Invalid credentials' });
  }
});
```

### 3. 🔄 Hybrid Authentication (Best of Both)
**Support both JWT and sessions**

```typescript
// Accept both authentication methods
app.get('/profile', [sessionAuth(), jwtAuth('your-secret')], (req, res) => {
  // Works with either session cookies OR Authorization header
  res.json({ user: req.user });
});
```

## 👥 User Management

### Registration
```typescript
app.post('/register', async (req, res) => {
  try {
    const user = await app.auth.register({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      roles: ['user'] // default role
    });
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### Password Management
```typescript
// Change password
app.post('/change-password', sessionAuth(), async (req, res) => {
  const success = await app.auth.changePassword(
    req.user.id, 
    req.body.currentPassword, 
    req.body.newPassword
  );
  res.json({ success });
});

// Password reset (you'd typically send this via email)
app.post('/reset-password', async (req, res) => {
  const token = await app.auth.generatePasswordResetToken(req.body.email);
  // Send token via email...
  res.json({ message: 'Reset token sent' });
});
```

## 🔒 Role-Based Access Control

### Define Roles
```typescript
// User with multiple roles
const adminUser = await app.auth.register({
  username: 'admin',
  email: 'admin@example.com', 
  password: 'secure123',
  roles: ['admin', 'user', 'moderator']
});
```

### Protect Routes by Role
```typescript
// Admin only
app.get('/admin', [sessionAuth(), hasRole(['admin'])], (req, res) => {
  res.render('admin-dashboard');
});

// Multiple roles allowed  
app.get('/moderator', [sessionAuth(), hasRole(['admin', 'moderator'])], (req, res) => {
  res.render('moderator-panel');
});

// Check roles in handler
app.get('/content', sessionAuth(), (req, res) => {
  if (req.user.roles.includes('premium')) {
    res.render('premium-content');
  } else {
    res.render('basic-content');
  }
});
```

## 🛡️ Security Middleware

### CSRF Protection
```typescript
import { csrfProtection } from '@kenx/framework';

app.use(csrfProtection());

// CSRF token available in templates
app.get('/form', (req, res) => {
  res.render('form', { csrfToken: req.csrfToken() });
});
```

### Rate Limiting
```typescript
import { rateLimit } from '@kenx/framework';

// Global rate limiting
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Specific endpoint limiting
app.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), async (req, res) => {
  // Login logic...
});
```

### Security Headers
```typescript
import { securityHeaders } from '@kenx/framework';

app.use(securityHeaders({
  contentSecurityPolicy: true,
  strictTransportSecurity: true,
  xFrameOptions: 'DENY'
}));
```

## 🌐 CORS for Frontend Separation
```typescript
import { cors } from '@kenx/framework';

// Allow specific frontend domains
app.use(cors({
  origin: ['https://myapp.netlify.app', 'https://myapp.vercel.app'],
  credentials: true, // Allow cookies for sessions
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
```

## 📱 Frontend Integration

### Using the Client Library
```typescript
import { KenxClient } from '@kenx/framework/client';

const client = new KenxClient({
  baseUrl: 'https://your-api.com',
  // Optional: auto token refresh
  onTokenRefresh: (newToken) => localStorage.setItem('token', newToken)
});

// Login
const { user, token } = await client.login({
  username: 'user@example.com',
  password: 'password123'
});

// Auto-authenticated requests
const posts = await client.get('/api/posts');
const newPost = await client.post('/api/posts', { title: 'My Post' });
```

### React Hook Example
```typescript
import { useKenxAuth } from '@kenx/framework/react'; // Coming soon!

function MyComponent() {
  const { user, login, logout, loading } = useKenxAuth();
  
  if (loading) return <div>Loading...</div>;
  
  return user ? (
    <div>Welcome {user.username}! <button onClick={logout}>Logout</button></div>
  ) : (
    <LoginForm onLogin={login} />
  );
}
```

## 🏗️ Complete Auth Example

```typescript
import kenx, { 
  sessionAuth, jwtAuth, hasRole, 
  csrfProtection, rateLimit, securityHeaders, cors 
} from '@kenx/framework';

const app = kenx({
  database: { type: 'json', path: './data/auth.db' },
  auth: {
    enabled: true,
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret',
    sessionSecret: process.env.SESSION_SECRET || 'your-session-secret',
    saltRounds: 12, // bcrypt salt rounds
    pepper: process.env.PEPPER, // additional security
  }
});

// Security middleware
app.use(securityHeaders());
app.use(cors({ origin: ['https://myapp.com'], credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(csrfProtection());

// Auth routes
app.post('/register', rateLimit({ max: 3 }), async (req, res) => {
  const user = await app.auth.register(req.body);
  res.json({ success: true, user });
});

app.post('/login', rateLimit({ max: 5 }), async (req, res) => {
  const result = await app.auth.login(req.body.username, req.body.password);
  if (result.success) {
    req.session.userId = result.user.id; // Session
    res.json({ token: result.token, user: result.user }); // JWT
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Protected routes
app.get('/profile', [sessionAuth(), jwtAuth()], (req, res) => {
  res.json({ user: req.user });
});

app.get('/admin', [sessionAuth(), hasRole(['admin'])], (req, res) => {
  res.json({ message: 'Admin access granted' });
});

app.listen(3000);
```

## 🎯 Best Practices

1. **🔑 Use Environment Variables** - Never hardcode secrets
2. **🛡️ Rate Limit Auth Endpoints** - Prevent brute force attacks  
3. **🍪 Secure Session Cookies** - Use httpOnly, secure, sameSite
4. **🔄 Token Rotation** - Implement refresh tokens for long-lived apps
5. **📝 Audit Logs** - Track authentication events
6. **⚡ Use HTTPS** - Always in production
7. **🔒 Strong Passwords** - Enforce password policies
8. **👥 Principle of Least Privilege** - Minimal roles needed

---

**Kenx Authentication makes security simple and powerful! 🚀**

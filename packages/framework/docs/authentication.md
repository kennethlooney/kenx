# JWT Authentication in Kenx Framework

The Kenx framework includes a robust JWT (JSON Web Token) authentication system that works seamlessly for both web applications and mobile/API clients. This system provides flexible authentication options and can be used alongside session-based authentication.

## Features

- **Pure TypeScript Implementation**: No external dependencies for JWT handling
- **Flexible Authentication**: Supports both session-based and JWT-based authentication
- **Multi-platform Support**: Works with web browsers, mobile apps, and API clients
- **Hybrid Authentication**: Can use both sessions and JWT tokens simultaneously
- **Role-based Access Control**: Built-in support for user roles and permissions
- **Token Refresh**: Secure token refresh mechanism for long-lived applications
- **Security Features**: Password hashing, CSRF protection, rate limiting

## Quick Start

### 1. Basic Setup

```typescript
import { Kenx, auth, jwtAuth, JWT, UserManager, PasswordUtils } from '@kenx/framework';

const app = new Kenx({
  port: 3000,
  database: {
    type: 'memory' // or 'json' for file-based storage
  },
  auth: {
    enabled: true,
    jwtSecret: 'your-super-secret-jwt-key-change-in-production',
    sessionSecret: 'your-session-secret-key',
    sessionExpiry: 24 * 60 * 60 * 1000 // 24 hours
  }
});

// Initialize user manager
const userManager = new UserManager(app.db);
```

### 2. Authentication Routes

```typescript
// Registration endpoint
app.post('/auth/register', async (req: KenxRequest, res: KenxResponse) => {
  const { email, password, firstName, lastName, platform } = req.body;
  
  const user = await userManager.createUser({
    email,
    password,
    firstName,
    lastName,
    roles: ['user']
  });
  
  const isMobile = platform === 'mobile';
  
  if (isMobile) {
    // Return JWT token for mobile/API clients
    const token = JWT.create(
      { id: user.id, email: user.email, roles: user.roles },
      app.config.auth.jwtSecret,
      '7d'
    );
    
    return res.json({ success: true, token, user });
  } else {
    // Use session for web clients
    await req.login(user);
    res.redirect('/dashboard');
  }
});

// Login endpoint
app.post('/auth/login', async (req: KenxRequest, res: KenxResponse) => {
  const { email, password, platform } = req.body;
  
  const user = await userManager.authenticateUser(email, password);
  if (!user) {
    return res.error('Invalid credentials', 401);
  }
  
  const isMobile = platform === 'mobile';
  
  if (isMobile) {
    const token = JWT.create(
      { id: user.id, email: user.email, roles: user.roles },
      app.config.auth.jwtSecret,
      '7d'
    );
    
    return res.json({ success: true, token, user });
  } else {
    await req.login(user);
    res.redirect('/dashboard');
  }
});
```

### 3. Protected Routes

#### Hybrid Authentication (Web + Mobile)
```typescript
// Works with both session cookies and JWT tokens
app.get('/dashboard', auth({
  jwt: {
    secret: app.config.auth.jwtSecret,
    cookieName: 'jwt' // Also check JWT cookie
  },
  session: true,
  redirectTo: '/login'
}), (req: KenxRequest, res: KenxResponse) => {
  const user = req.user || req.session.user;
  
  if (req.headers.accept?.includes('application/json')) {
    // API response
    return res.json({ message: 'Welcome!', user });
  } else {
    // Web response
    return res.render('dashboard', { user });
  }
});
```

#### JWT-Only Authentication (API)
```typescript
// Pure API endpoints using JWT only
app.get('/api/profile', jwtAuth(app.config.auth.jwtSecret), (req: KenxRequest, res: KenxResponse) => {
  return res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      roles: req.user.roles
    }
  });
});

app.put('/api/profile', jwtAuth(app.config.auth.jwtSecret), async (req: KenxRequest, res: KenxResponse) => {
  const { firstName, lastName } = req.body;
  const updatedUser = await userManager.updateUser(req.user.id, { firstName, lastName });
  
  return res.json({ success: true, user: updatedUser });
});
```

#### Role-based Access Control
```typescript
import { requireRole } from '@kenx/framework';

// Require specific role
app.get('/admin', 
  jwtAuth(app.config.auth.jwtSecret),
  requireRole('admin'),
  (req: KenxRequest, res: KenxResponse) => {
    return res.json({ message: 'Admin area' });
  }
);

// Require multiple roles (any of them)
app.get('/moderator', 
  jwtAuth(app.config.auth.jwtSecret),
  requireRole(['admin', 'moderator']),
  (req: KenxRequest, res: KenxResponse) => {
    return res.json({ message: 'Moderator area' });
  }
);
```

### 4. Token Refresh

```typescript
app.post('/api/auth/refresh', jwtAuth(app.config.auth.jwtSecret), (req: KenxRequest, res: KenxResponse) => {
  // Create a new token with updated expiration
  const newToken = JWT.create(
    { 
      id: req.user.id, 
      email: req.user.email, 
      roles: req.user.roles 
    },
    app.config.auth.jwtSecret,
    '7d'
  );
  
  return res.json({ success: true, token: newToken });
});
```

## Mobile Client Integration

### JavaScript/TypeScript Client

```typescript
class KenxMobileClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  async login(email: string, password: string) {
    const result = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, platform: 'mobile' }),
    });

    if (result.success && result.token) {
      this.saveToken(result.token);
      return result;
    }

    throw new Error('Login failed');
  }

  async getProfile() {
    return this.request('/api/profile');
  }
}
```

### React Native Example

```jsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://your-kenx-app.com/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, platform: 'mobile' }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Store token securely
        await AsyncStorage.setItem('auth_token', result.token);
        Alert.alert('Success', 'Logged in successfully!');
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button
        title={loading ? "Logging in..." : "Login"}
        onPress={handleLogin}
        disabled={loading}
      />
    </View>
  );
}
```

## JWT Configuration Options

### Authentication Middleware Options

```typescript
// auth() middleware options
auth({
  jwt: {
    secret: 'your-jwt-secret',
    cookieName: 'jwt',           // Check JWT in cookie
    headerName: 'x-auth-token'   // Check custom header
  },
  session: true,                 // Also check sessions
  redirectTo: '/login'           // Redirect unauthorized users
})

// jwtAuth() middleware - JWT only
jwtAuth('your-jwt-secret')
```

### JWT Token Creation

```typescript
// Create JWT token
const token = JWT.create(
  payload,                       // User data
  secret,                       // Secret key
  expiresIn                     // '1h', '7d', '30d', or seconds
);

// Verify JWT token
try {
  const payload = JWT.verify(token, secret);
  console.log('User:', payload);
} catch (error) {
  console.log('Invalid token');
}

// Decode JWT token (without verification)
const payload = JWT.decode(token);
```

## Security Best Practices

1. **Use Strong Secrets**: Use long, random JWT secrets
2. **Short Expiration**: Use short-lived tokens with refresh mechanism
3. **Secure Storage**: Store tokens securely on the client side
4. **HTTPS Only**: Always use HTTPS in production
5. **Rate Limiting**: Use built-in rate limiting for auth endpoints
6. **CSRF Protection**: Enable CSRF protection for web clients
7. **Input Validation**: Validate all inputs before processing

## Error Handling

The authentication system provides detailed error responses:

```json
{
  "success": false,
  "message": "Invalid credentials",
  "timestamp": "2025-06-21T09:20:55.848Z"
}
```

Common error codes:
- `401`: Authentication required or invalid credentials
- `403`: Insufficient permissions
- `429`: Too many requests (rate limited)
- `500`: Internal server error

## Testing

Test your JWT authentication:

```bash
# Register user
curl -X POST http://localhost:3000/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","password":"password123","firstName":"John","platform":"mobile"}'

# Login
curl -X POST http://localhost:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","password":"password123","platform":"mobile"}'

# Access protected API
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  http://localhost:3000/api/profile
```

This JWT authentication system provides a robust, secure, and flexible solution for both web and mobile applications using the Kenx framework.
  
  const user = await userManager.authenticateUser(email, password);
  if (!user) {
    return res.error('Invalid credentials', 401);
  }
  
  // Mobile/API: Return JWT token
  if (platform === 'mobile' || req.headers.accept?.includes('application/json')) {
    const token = JWT.create({ id: user.id, email: user.email }, 
                             app.config.auth.jwtSecret, '7d');
    return res.json({ success: true, token, user });
  }
  
  // Web: Use session
  await req.login(user);
  res.redirect('/dashboard');
});
```

### 3. Protected Routes

```typescript
import { auth, jwtAuth } from 'kenx';

// Hybrid authentication (sessions + JWT)
app.get('/dashboard', auth({
  jwt: {
    secret: app.config.auth.jwtSecret,
    cookieName: 'jwt'
  },
  session: true,
  redirectTo: '/login'
}), (req, res) => {
  res.json({ message: 'Welcome!', user: req.user });
});

// JWT-only for APIs
app.get('/api/profile', jwtAuth(app.config.auth.jwtSecret), (req, res) => {
  res.json({ user: req.user });
});
```

## Authentication Methods

### Session-Based Authentication

Perfect for traditional web applications:

```typescript
// Login creates a session
await req.login(user);

// Check authentication status
if (req.isAuthenticated()) {
  // User is logged in
}

// Logout destroys session
await req.logout();
```

### JWT Authentication

Ideal for mobile apps and APIs:

```typescript
// Create JWT token
const token = JWT.create(
  { id: user.id, email: user.email, roles: user.roles },
  'your-secret-key',
  '7d' // expires in 7 days
);

// Verify JWT token
try {
  const payload = JWT.verify(token, 'your-secret-key');
  console.log('User:', payload);
} catch (error) {
  console.log('Invalid token');
}
```

### Hybrid Authentication

Use both methods simultaneously:

```typescript
app.use('/protected', auth({
  jwt: {
    secret: process.env.JWT_SECRET,
    cookieName: 'jwt',      // Check JWT cookie
    headerName: 'x-token'   // Check custom header
  },
  session: true,            // Also check sessions
  redirectTo: '/login'
}));
```

## Mobile Integration

### React Native Example

```typescript
class KenxMobileClient {
  async login(email: string, password: string) {
    const response = await fetch('https://your-app.com/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, platform: 'mobile' })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Store token securely
      await AsyncStorage.setItem('token', result.token);
      return result;
    }
    
    throw new Error(result.error);
  }
  
  async apiRequest(endpoint: string, options = {}) {
    const token = await AsyncStorage.getItem('token');
    
    return fetch(`https://your-app.com${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }
}
```

### Flutter Example

```dart
class KenxFlutterClient {
  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('https://your-app.com/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'email': email,
        'password': password,
        'platform': 'mobile'
      }),
    );
    
    final data = json.decode(response.body);
    
    if (data['success']) {
      await _saveToken(data['token']);
      return data;
    }
    
    throw Exception(data['error']);
  }
}
```

## User Management

### Creating Users

```typescript
const userManager = new UserManager(app.db);

// Create a new user
const user = await userManager.createUser({
  email: 'user@example.com',
  password: 'securepassword',
  firstName: 'John',
  lastName: 'Doe',
  roles: ['user', 'admin']
});
```

### Authentication

```typescript
// Authenticate user
const user = await userManager.authenticateUser('user@example.com', 'password');

if (user) {
  console.log('Authentication successful');
} else {
  console.log('Invalid credentials');
}
```

### User Operations

```typescript
// Find user by ID
const user = await userManager.findUserById('user-id');

// Update user
const updatedUser = await userManager.updateUser('user-id', {
  firstName: 'Jane',
  roles: ['user', 'premium']
});
```

## Role-Based Access Control

```typescript
import { requireRole } from 'kenx';

// Require specific role
app.get('/admin', requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin only area' });
});

// Require any of multiple roles
app.get('/premium', requireRole(['premium', 'admin']), (req, res) => {
  res.json({ message: 'Premium content' });
});
```

## Security Features

### Password Hashing

```typescript
import { PasswordUtils } from 'kenx';

// Hash password
const hashedPassword = PasswordUtils.hash('plaintext-password');

// Verify password
const isValid = PasswordUtils.verify('plaintext-password', hashedPassword);
```

### CSRF Protection

```typescript
import { csrfProtection } from 'kenx';

// Apply CSRF protection to forms
app.use('/forms', csrfProtection());

// CSRF token is available in req.session.csrfToken
app.get('/form', (req, res) => {
  res.render('form', { csrfToken: req.session.csrfToken });
});
```

### Rate Limiting

```typescript
import { authRateLimit } from 'kenx';

// Apply rate limiting to auth endpoints
app.use('/auth', authRateLimit());
```

## Configuration Options

```typescript
const app = new Kenx({
  auth: {
    enabled: true,
    
    // JWT settings
    jwtSecret: 'your-jwt-secret',
    
    // Session settings
    sessionSecret: 'your-session-secret',
    sessionExpiry: 24 * 60 * 60 * 1000, // 24 hours
    
    // Route settings
    loginRoute: '/login',
    logoutRoute: '/logout',
    protectedRoutes: ['/dashboard', '/profile']
  }
});
```

## Best Practices

### 1. Use Strong Secrets

```typescript
// Generate secure random secrets
const crypto = require('crypto');
const jwtSecret = crypto.randomBytes(64).toString('hex');
const sessionSecret = crypto.randomBytes(64).toString('hex');
```

### 2. Handle Token Expiration

```typescript
// Mobile app: Automatically refresh tokens
class TokenManager {
  async makeRequest(url, options) {
    let token = await this.getToken();
    
    // Try request with current token
    let response = await fetch(url, {
      ...options,
      headers: { ...options.headers, 'Authorization': `Bearer ${token}` }
    });
    
    // If token expired, refresh and retry
    if (response.status === 401) {
      token = await this.refreshToken();
      response = await fetch(url, {
        ...options,
        headers: { ...options.headers, 'Authorization': `Bearer ${token}` }
      });
    }
    
    return response;
  }
}
```

### 3. Secure Token Storage

```typescript
// React Native: Use secure storage
import * as SecureStore from 'expo-secure-store';

await SecureStore.setItemAsync('userToken', token);
const token = await SecureStore.getItemAsync('userToken');
```

### 4. Environment Variables

```typescript
// Use environment variables for secrets
const app = new Kenx({
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    sessionSecret: process.env.SESSION_SECRET
  }
});
```

## API Reference

### Middleware Functions

- `auth(options)` - Flexible authentication middleware
- `jwtAuth(secret)` - JWT-only authentication
- `requireRole(roles)` - Role-based access control
- `csrfProtection()` - CSRF protection
- `authRateLimit()` - Rate limiting for auth endpoints

### Classes

- `JWT` - JWT token creation and verification
- `UserManager` - User database operations
- `PasswordUtils` - Password hashing utilities

### Request Extensions

- `req.user` - Currently authenticated user
- `req.session` - Session data
- `req.isAuthenticated()` - Check if user is logged in
- `req.login(user)` - Log in user (creates session)
- `req.logout()` - Log out user (destroys session)

This authentication system provides everything you need to build secure, modern web and mobile applications with the Kenx framework.

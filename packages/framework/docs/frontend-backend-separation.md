# 🚀 Kenx Frontend/Backend Separation Guide

This guide shows how to deploy Kenx applications with **separate frontend and backend**, enabling modern deployment patterns like:

- **Backend**: VPS, AWS, Google Cloud, Railway, Render
- **Frontend**: Netlify, Vercel, GitHub Pages, CloudFlare Pages

## 📋 Architecture Overview

```
┌─────────────────┐    HTTPS/API     ┌──────────────────┐
│                 │    Requests      │                  │
│   Frontend      │ ──────────────→  │   Backend API    │
│   (Static)      │                  │   (Node.js)      │
│                 │ ←──────────────   │                  │
└─────────────────┘    JSON/CORS     └──────────────────┘
│                                    │
│ • HTML/CSS/JS                      │ • REST API
│ • React/Vue/Angular                │ • Database
│ • Static Hosting                   │ • Authentication
│ • CDN Distribution                 │ • Business Logic
└─ Netlify, Vercel                   └─ VPS, AWS, Railway
```

## 🏗️ Project Structure

```
my-kenx-app/
├── backend/                    # Kenx API Server
│   ├── src/
│   │   ├── server.ts          # API server
│   │   ├── routes/            # API routes
│   │   └── models/            # Database models
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── frontend/                   # Static Frontend
│   ├── src/
│   │   ├── index.html         # Main HTML
│   │   ├── app.js             # Frontend logic
│   │   ├── kenx-client.js     # API client
│   │   └── styles.css         # Styles
│   ├── package.json           # Build tools (optional)
│   └── netlify.toml           # Deployment config
└── shared/                     # Shared types (optional)
    └── types.ts
```

## 🛠️ Backend Setup (API Server)

### 1. Create API Server

```typescript
// backend/src/server.ts
import { Kenx, cors, json, logger } from '@kenx/framework';

const api = new Kenx({
  port: process.env.PORT || 4000,
  database: {
    type: 'json',
    path: './data/production.db'
  },
  auth: {
    enabled: true,
    jwtSecret: process.env.JWT_SECRET!
  }
});

// CORS for frontend domains
api.use(cors({
  origin: [
    'http://localhost:3000',           // Local development
    'https://myapp.netlify.app',       // Netlify
    'https://myapp.vercel.app',        // Vercel
    'https://myapp.pages.dev',         // Cloudflare Pages
    'https://mydomain.com'             // Custom domain
  ],
  credentials: true
}));

api.use(json());
api.use(logger());

// API routes
api.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Authentication endpoints
api.post('/api/auth/login', async (req, res) => {
  // Login logic here
});

api.get('/api/posts', async (req, res) => {
  // Get posts logic here
});

api.start();
```

### 2. Environment Variables

```bash
# backend/.env
NODE_ENV=production
PORT=4000
JWT_SECRET=your-super-secret-jwt-key
DB_TYPE=json
DB_PATH=./data/production.db
CORS_ORIGINS=https://myapp.netlify.app,https://mydomain.com
```

### 3. Package.json

```json
{
  "name": "my-kenx-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "deploy": "npm run build && pm2 restart kenx-api"
  },
  "dependencies": {
    "@kenx/framework": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "ts-node": "^10.0.0"
  }
}
```

## 🎨 Frontend Setup (Static)

### 1. Frontend Client

```javascript
// frontend/src/kenx-client.js
class KenxClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('auth_token');
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async login(credentials) {
    const result = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    
    if (result.token) {
      this.token = result.token;
      localStorage.setItem('auth_token', result.token);
    }
    
    return result;
  }
  
  async getPosts() {
    return this.request('/api/posts');
  }
}

// Initialize client
const API_BASE_URL = 'https://your-api-server.com';
const kenx = new KenxClient(API_BASE_URL);
```

### 2. Main HTML

```html
<!-- frontend/src/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Kenx App</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <header>
      <h1>My Kenx App</h1>
      <nav id="nav"></nav>
    </header>
    
    <main id="content">
      <!-- Dynamic content goes here -->
    </main>
  </div>
  
  <script src="kenx-client.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

### 3. Frontend Logic

```javascript
// frontend/src/app.js
class App {
  constructor() {
    this.user = null;
    this.init();
  }
  
  async init() {
    if (kenx.token) {
      try {
        this.user = await kenx.request('/api/auth/me');
      } catch (error) {
        kenx.clearToken();
      }
    }
    
    this.render();
  }
  
  render() {
    const nav = document.getElementById('nav');
    const content = document.getElementById('content');
    
    if (this.user) {
      nav.innerHTML = `
        <span>Welcome, ${this.user.username}!</span>
        <button onclick="app.logout()">Logout</button>
      `;
      this.renderPosts(content);
    } else {
      nav.innerHTML = '<button onclick="app.showLogin()">Login</button>';
      this.renderLogin(content);
    }
  }
  
  async renderPosts(container) {
    try {
      const posts = await kenx.getPosts();
      container.innerHTML = `
        <h2>Posts</h2>
        <div class="posts">
          ${posts.map(post => `
            <article class="post">
              <h3>${post.title}</h3>
              <p>${post.content}</p>
              <small>By ${post.author}</small>
            </article>
          `).join('')}
        </div>
      `;
    } catch (error) {
      container.innerHTML = `<p>Error loading posts: ${error.message}</p>`;
    }
  }
  
  renderLogin(container) {
    container.innerHTML = `
      <form onsubmit="app.login(event)">
        <h2>Login</h2>
        <input type="text" id="username" placeholder="Username" required>
        <input type="password" id="password" placeholder="Password" required>
        <button type="submit">Login</button>
      </form>
    `;
  }
  
  async login(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
      const result = await kenx.login({ username, password });
      this.user = result.user;
      this.render();
    } catch (error) {
      alert('Login failed: ' + error.message);
    }
  }
  
  logout() {
    kenx.clearToken();
    this.user = null;
    this.render();
  }
}

// Initialize app
const app = new App();
```

## 🚀 Deployment

### Backend Deployment (VPS/Cloud)

#### Option 1: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway add
railway deploy
```

#### Option 2: Render
```yaml
# render.yaml
services:
  - type: web
    name: kenx-api
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
```

#### Option 3: VPS (Digital Ocean, Linode)
```bash
# Install Node.js and PM2
sudo apt update
sudo apt install nodejs npm
npm install -g pm2

# Clone and setup
git clone https://github.com/yourusername/your-app.git
cd your-app/backend
npm install
npm run build

# Start with PM2
pm2 start dist/server.js --name kenx-api
pm2 startup
pm2 save

# Setup reverse proxy (nginx)
sudo apt install nginx
```

### Frontend Deployment (Static Hosting)

#### Option 1: Netlify
```toml
# frontend/netlify.toml
[build]
  publish = "src"
  
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  API_BASE_URL = "https://your-api-server.com"
```

#### Option 2: Vercel
```json
// frontend/vercel.json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "env": {
    "API_BASE_URL": "https://your-api-server.com"
  }
}
```

#### Option 3: GitHub Pages
```yaml
# .github/workflows/deploy.yml
name: Deploy Frontend
on:
  push:
    branches: [ main ]
    
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/src
```

## 🔧 Environment Configuration

### Development
```javascript
// Use local API server
const API_BASE_URL = 'http://localhost:4000';
```

### Production
```javascript
// Use deployed API server
const API_BASE_URL = 'https://your-api-server.com';
```

### Environment Detection
```javascript
const API_BASE_URL = 
  window.location.hostname === 'localhost' 
    ? 'http://localhost:4000'
    : 'https://your-api-server.com';
```

## 🛡️ Security Considerations

### 1. CORS Configuration
```typescript
api.use(cors({
  origin: process.env.FRONTEND_URLS?.split(',') || [
    'https://yourapp.netlify.app'
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 2. Environment Variables
```bash
# Never commit secrets to git!
# Use platform-specific environment variable management

# Railway/Render: Web dashboard
# Vercel: Environment Variables section
# Netlify: Site settings > Environment variables
```

### 3. API Rate Limiting
```typescript
import { rateLimit } from '@kenx/framework';

api.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));
```

## 📊 Monitoring & Analytics

### Backend Monitoring
```typescript
// Health check endpoint
api.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'connected'
  });
});
```

### Frontend Analytics
```html
<!-- Google Analytics, Plausible, etc. -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
```

## 🎯 Benefits of This Architecture

### ✅ **Scalability**
- Frontend and backend scale independently
- CDN distribution for frontend assets
- Multiple backend instances behind load balancer

### ✅ **Cost Efficiency**
- Static frontend hosting is often free (Netlify, Vercel)
- Backend only pays for compute time
- CDN reduces bandwidth costs

### ✅ **Developer Experience**
- Teams can work independently on frontend/backend
- Different deployment cycles
- Technology flexibility (React, Vue, Angular for frontend)

### ✅ **Performance**
- Frontend served from CDN (global distribution)
- Cached static assets
- Reduced server load

### ✅ **Reliability**
- Frontend remains available even if API is down
- Graceful degradation
- Independent deployment rollbacks

## 📚 Next Steps

1. **Set up CI/CD pipelines** for automated deployments
2. **Add monitoring** with services like Sentry or LogRocket  
3. **Implement caching** with Redis for API responses
4. **Add WebSocket support** for real-time features
5. **Set up staging environments** for testing

## 🤝 Example Projects

Check out these example implementations:
- `examples/api-server.ts` - Complete API server
- `examples/frontend-client.ts` - Frontend client library
- `examples/static-frontend-demo.html` - Working static demo

---

This architecture pattern enables modern, scalable web applications with the flexibility to deploy components independently while maintaining the simplicity and power of the Kenx framework! 🚀

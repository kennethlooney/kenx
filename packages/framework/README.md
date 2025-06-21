# Kenx Framework

A modern, lightweight Node.js web framework built with TypeScript, designed for building both **full-stack applications** and **decoupled API backends**.

> **🔥 Coming Next**: CLI Generator! `npx create-kenx-app` with **Full-Stack**, **API Backend**, or **Frontend Client** project types. [See the plan →](docs/cli-generator-plan.md)

## 🎯 Architecture Flexibility

Kenx supports **three deployment patterns**:

1. **🏢 Full-Stack** - Traditional monolithic deployment (frontend + backend together)
2. **🔗 API Backend** - Pure REST API server for decoupled frontends
3. **📱 Hybrid** - API-first with optional server-side rendering

## ✨ Core Features

### 🚀 **Framework Essentials**
- **TypeScript-first** - Built with complete type safety
- **Zero Dependencies** - Lightweight with minimal external deps
- **Express-like API** - Familiar middleware and routing patterns
- **Plugin Architecture** - Extensible with custom plugins

### 🗄️ **Database & ORM**
- **Built-in Database** - JSON-based with relationships
- **Model System** - Define schemas with validation
- **Query Builder** - Powerful querying capabilities
- **Migrations** - Schema evolution support

### 🔐 **Authentication & Security**
- **JWT Authentication** - Stateless token-based auth (perfect for APIs)
- **Session Management** - Traditional web sessions (great for full-stack)
- **Hybrid Auth Support** - Use both JWT and sessions simultaneously
- **Role-based Access Control** - Fine-grained user permissions
- **Password Security** - Secure hashing with salt and pepper
- **CSRF Protection** - Cross-site request forgery prevention
- **Rate Limiting** - Protect against brute force attacks
- **Security Headers** - HSTS, CSP, XSS protection, and more

### 🎨 **Frontend Integration**
- **Template Engine** - Custom Kenx template syntax with layouts
- **Static File Serving** - Built-in asset handling
- **Frontend Client** - TypeScript client for API consumption
- **CORS Ready** - Cross-origin support for decoupled frontends

### ⚡ **Real-time & Performance**
- **WebSocket Support** - Built-in real-time capabilities
- **Compression** - Gzip/Brotli response compression
- **Request Timeout** - Configurable timeout handling
- **Health Checks** - Built-in monitoring endpoints

## � Future CLI Generator (Coming Soon!)

> **📝 Development Note**: We plan to create a CLI tool that will let you generate different project types:
>
> ```bash
> npx create-kenx-app my-app
> # Choose your project type:
> # ► 🏢 Full-Stack Application (Frontend + Backend together)
> # ► 🔗 API Backend Only (For decoupled frontends)  
> # ► 📱 Frontend Client Only (Connect to existing API)
> ```
>
> This will dramatically simplify project setup! For now, use the manual examples below.

## �🚀 Quick Start

### Full-Stack Application
```typescript
import kenx from '@kenx/framework';

const app = kenx({
  database: { type: 'json', path: './data/app.db' },
  views: { engine: 'kenx', viewsDir: './views' },
  auth: { enabled: true, jwtSecret: 'your-secret' }
});

app.get('/', async (req, res) => {
  await res.render('home', { title: 'Welcome to Kenx!' });
});

app.listen(3000);
```

### API-Only Backend
```typescript
import kenx, { cors, json, jwtAuth } from '@kenx/framework';

const api = kenx({
  database: { type: 'json', path: './api.db' },
  auth: { enabled: true, jwtSecret: 'your-secret' }
});

api.use(cors({ origin: ['https://myapp.netlify.app'] }));
api.use(json());

api.get('/api/posts', (req, res) => {
  const posts = api.db.findAll('posts');
  res.json({ success: true, data: posts });
});

api.post('/api/posts', jwtAuth('your-secret'), (req, res) => {
  const post = api.db.insert('posts', req.body);
  res.json({ success: true, data: post });
});

api.listen(4000);
```

### Frontend Client (React/Vue/Vanilla)
```typescript
import { KenxClient } from '@kenx/framework/client';

const client = new KenxClient({
  baseUrl: 'https://your-api-server.com'
});

// Login user
const { user, token } = await client.login({
  username: 'user@example.com',
  password: 'password123'
});

// Get posts
const { posts } = await client.getPosts({ page: 1, limit: 10 });

// Create post (requires auth)
const newPost = await client.createPost({
  title: 'My Post',
  content: 'Post content here'
});
```

### 🔐 Authentication Example
```typescript
import kenx, { sessionAuth, jwtAuth, hasRole } from '@kenx/framework';

const app = kenx({
  auth: { 
    enabled: true, 
    jwtSecret: 'your-jwt-secret',
    sessionSecret: 'your-session-secret'
  }
});

// Login endpoint (works with both JWT and sessions)
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await app.auth.login(username, password);
  
  if (result.success) {
    // Set both JWT and session for maximum flexibility
    res.setHeader('Authorization', `Bearer ${result.token}`);
    req.session.userId = result.user.id;
    res.json({ success: true, user: result.user, token: result.token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Protected route (accepts both JWT and session auth)
app.get('/profile', [sessionAuth(), jwtAuth('your-jwt-secret')], (req, res) => {
  res.json({ user: req.user });
});

// Admin-only route
app.get('/admin', [sessionAuth(), hasRole(['admin'])], (req, res) => {
  res.json({ message: 'Admin dashboard' });
});
```

## 📚 Architecture Examples

### 🏢 Monolithic Deployment
```
┌─────────────────────────────┐
│     Kenx Full-Stack App     │
│  ┌─────────┐ ┌────────────┐ │
│  │Frontend │ │  Backend   │ │
│  │ Views   │ │  API + DB  │ │
│  └─────────┘ └────────────┘ │
└─────────────────────────────┘
    Deploy to: VPS, Heroku
```

### 🔗 Decoupled Deployment
```
┌─────────────────┐    API     ┌──────────────────┐
│   Frontend      │  Requests  │   Kenx API       │
│   React/Vue     │ ────────►  │   Backend        │
│   Netlify       │            │   Railway/VPS    │
└─────────────────┘ ◄────────── └──────────────────┘
    FREE Hosting      CORS        $5-20/month
```

## 📖 Complete Examples

### 🔐 **Authentication Examples**
- **[🎫 JWT + Session Auth](examples/auth-example.ts)** - Complete auth system with all features
- **[👤 User Management](examples/auth-example.ts)** - Registration, login, roles, permissions

### �️ **Architecture Examples**  
- **[�🏢 Full-Stack App](examples/fullstack-app.ts)** - Traditional monolithic web application
- **[🔗 Simple API Server](examples/simple-api-server.ts)** - Clean backend for decoupled frontends
- **[📊 Advanced API Server](examples/api-server.ts)** - Production API with OpenAPI docs

### 📱 **Frontend Integration**
- **[🌐 Frontend Client](examples/frontend-client.ts)** - TypeScript client library
- **[📄 Static HTML Demo](examples/static-frontend-demo.html)** - Vanilla JS/HTML client
- **[⚛️ React Integration](examples/react-frontend-example.md)** - Modern React app example

> **💡 Pro Tip**: Each example is fully runnable! Copy and run them to see Kenx in action.

## � Documentation

### 🚀 **Getting Started**
- **[🔮 CLI Generator Plan](docs/cli-generator-plan.md)** - Future CLI tool for easy project creation
- **[📖 Migration Guide](docs/migration-guide.md)** - Upgrade from v1.x to v2.0
- **[🏗️ Frontend/Backend Separation](docs/frontend-backend-separation.md)** - Deployment guide

### 🔐 **Authentication & Security**  
- **[🔑 Authentication Guide](docs/authentication.md)** - Complete authentication system
- **[⚡ Quick Reference](docs/authentication-quick-reference.md)** - Authentication cheat sheet
- **[🛡️ Security Best Practices](docs/security.md)** - Production security guide

### 🎯 **Architecture & Examples**
- **[📋 Solution Summary](docs/separation-solution-summary.md)** - Architecture overview
- **[🏢 Full-Stack Examples](examples/fullstack-app.ts)** - Traditional web applications
- **[🔗 API Server Examples](examples/simple-api-server.ts)** - Backend-only deployment
- **[📱 Frontend Examples](examples/static-frontend-demo.html)** - Client-side integration

## �🛠️ Installation

```bash
npm install @kenx/framework
```

### TypeScript Setup
```bash
npm install -D typescript @types/node ts-node
npx tsc --init
```

### Development Dependencies
```bash
npm install -D nodemon concurrently
```

## 🎯 Deployment Options

### 🤔 Which Architecture Should You Choose?

| Feature | 🏢 Full-Stack | 🔗 API Backend | 📱 Frontend Only |
|---------|---------------|----------------|------------------|
| **Best For** | Traditional web apps | Modern decoupled apps | Existing API integration |
| **Hosting Cost** | $10-50/month | $5-20/month | FREE |
| **Scalability** | Moderate | High | Infinite |
| **Development** | Simple | Moderate | Easy |
| **SEO** | Excellent | Manual setup | With SSR |
| **Real-time** | Built-in | WebSocket API | Client implementation |

### Frontend Deployment (Static Hosting - FREE)
| Platform | Setup | Notes |
|----------|-------|-------|
| **Netlify** | `netlify deploy` | Auto-deploy from Git |
| **Vercel** | `vercel deploy` | Optimized for React/Next.js |
| **GitHub Pages** | Push to `gh-pages` | Free with GitHub repos |
| **Cloudflare Pages** | Connect repo | Global CDN included |

### Backend Deployment (API Server)
| Platform | Cost | Setup |
|----------|------|-------|
| **Railway** | $5/month | `railway deploy` |
| **Render** | $7/month | Connect GitHub |
| **VPS** | $5-20/month | Manual deployment |
| **AWS/GCP** | Variable | Enterprise scale |

### Full-Stack Deployment
| Platform | Cost | Notes |
|----------|------|-------|
| **VPS** | $10-50/month | Complete control |
| **Heroku** | $7-25/month | Easy deployment |
| **AWS/GCP** | Variable | Auto-scaling |

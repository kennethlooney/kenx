# Full-Stack Web Application

Build a complete full-stack web application with Kenx that demonstrates all the major features of the framework.

## Project Overview

We'll build a **Blog Platform** with:

- 📝 **Article Management** - Create, edit, delete articles
- 👥 **User System** - Registration, authentication
- 💬 **Comments** - Real-time comments with WebSocket
- 🔍 **Search** - Full-text search functionality
- 📱 **Responsive UI** - Modern, mobile-friendly interface
- 🔧 **Admin Panel** - Content management

## Project Setup

Create a new project:

```bash
mkdir kenx-blog
cd kenx-blog
npm init -y
npm install @kenx/framework
npm install --save-dev @types/node typescript ts-node
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Application Structure

```
kenx-blog/
├── src/
│   ├── app.ts          # Main application
│   ├── models/         # Database models
│   ├── routes/         # Route handlers
│   └── middleware/     # Custom middleware
├── views/              # Templates
│   ├── layouts/
│   ├── articles/
│   ├── auth/
│   └── admin/
├── public/             # Static assets
│   ├── css/
│   ├── js/
│   └── images/
└── data/               # Database files
```

## Main Application (`src/app.ts`)

```typescript
import kenx from '@kenx/framework';
import { json, logger, cors } from '@kenx/framework/middleware';
import { authPlugin } from '@kenx/framework/plugins';
import * as path from 'path';

// Create app with full configuration
const app = kenx({
  database: {
    type: 'json',
    path: './data/blog.db.json',
    autoSave: true
  },
  views: {
    engine: 'kenx',
    viewsDir: './views',
    layoutsDir: './views/layouts',
    defaultLayout: 'main'
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

// Global middleware
app.use(logger());
app.use(cors());
app.use(json());

// Register authentication plugin
app.register(authPlugin, {
  secret: process.env.JWT_SECRET || 'your-secret-key'
});

// Database Models
const User = app.db.define('users', {
  username: { type: 'string', required: true, unique: true },
  email: { type: 'string', required: true, unique: true },
  password: { type: 'string', required: true },
  role: { type: 'string', default: 'user' },
  createdAt: { type: 'date', default: () => new Date() }
});

const Article = app.db.define('articles', {
  title: { type: 'string', required: true },
  slug: { type: 'string', required: true, unique: true },
  content: { type: 'string', required: true },
  excerpt: { type: 'string' },
  authorId: { type: 'number', required: true },
  published: { type: 'boolean', default: false },
  tags: { type: 'array', default: [] },
  createdAt: { type: 'date', default: () => new Date() },
  updatedAt: { type: 'date', default: () => new Date() }
});

const Comment = app.db.define('comments', {
  content: { type: 'string', required: true },
  authorId: { type: 'number', required: true },
  articleId: { type: 'number', required: true },
  createdAt: { type: 'date', default: () => new Date() }
});

// Routes
import { setupRoutes } from './routes';
setupRoutes(app, { User, Article, Comment });

// WebSocket for real-time comments
if (app.ws) {
  app.ws.on('connection', (client) => {
    console.log(`Client connected: ${client.id}`);
  });

  app.ws.handle('comment', (client, data) => {
    try {
      const comment = Comment.create({
        content: data.content,
        authorId: data.authorId,
        articleId: data.articleId
      });

      const author = User.findById(comment.authorId);
      
      app.ws.toRoom(`article-${data.articleId}`, 'new-comment', {
        ...comment,
        author: { username: author.username }
      });
    } catch (error) {
      client.ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Failed to post comment' 
      }));
    }
  });
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Blog platform running on port ${PORT}`);
});
```

## Route Handlers (`src/routes/index.ts`)

```typescript
import { Kenx, KenxRequest, KenxResponse } from '@kenx/framework';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export function setupRoutes(app: Kenx, models: any) {
  const { User, Article, Comment } = models;

  // Home page - list articles
  app.get('/', async (req: KenxRequest, res: KenxResponse) => {
    const articles = Article.findAll({ 
      where: { published: true },
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit: 10
    });

    const articlesWithAuthors = articles.map(article => ({
      ...article,
      author: User.findById(article.authorId)
    }));

    await res.render('home', {
      title: 'Kenx Blog Platform',
      articles: articlesWithAuthors
    });
  });

  // Article detail page
  app.get('/article/:slug', async (req: KenxRequest, res: KenxResponse) => {
    const article = Article.findOne({ where: { slug: req.params.slug } });
    
    if (!article || !article.published) {
      return res.status(404).render('404', { 
        title: 'Article Not Found' 
      });
    }

    const author = User.findById(article.authorId);
    const comments = Comment.findAll({ 
      where: { articleId: article.id },
      orderBy: { field: 'createdAt', direction: 'desc' }
    }).map(comment => ({
      ...comment,
      author: User.findById(comment.authorId)
    }));

    await res.render('article/detail', {
      title: article.title,
      article: { ...article, author },
      comments
    });
  });

  // User registration
  app.get('/register', async (req: KenxRequest, res: KenxResponse) => {
    await res.render('auth/register', { title: 'Register' });
  });

  app.post('/register', async (req: KenxRequest, res: KenxResponse) => {
    try {
      const { username, email, password } = req.body;
      
      // Validate input
      if (!username || !email || !password) {
        return res.error('All fields are required', 400);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = User.create({
        username,
        email,
        password: hashedPassword
      });

      res.success({ id: user.id, username: user.username }, 
                   'Registration successful');
    } catch (error) {
      res.error('Registration failed', 400, error);
    }
  });

  // User login
  app.get('/login', async (req: KenxRequest, res: KenxResponse) => {
    await res.render('auth/login', { title: 'Login' });
  });

  app.post('/login', async (req: KenxRequest, res: KenxResponse) => {
    try {
      const { username, password } = req.body;
      
      const user = User.findOne({ where: { username } });
      if (!user) {
        return res.error('Invalid credentials', 401);
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.error('Invalid credentials', 401);
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.success({ token, user: { id: user.id, username: user.username } }, 
                   'Login successful');
    } catch (error) {
      res.error('Login failed', 500, error);
    }
  });

  // Create article (protected)
  app.get('/create', app.requireAuth(), async (req: KenxRequest, res: KenxResponse) => {
    await res.render('article/create', { title: 'Create Article' });
  });

  app.post('/create', app.requireAuth(), async (req: KenxRequest, res: KenxResponse) => {
    try {
      const { title, content, excerpt, tags } = req.body;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const article = Article.create({
        title,
        slug,
        content,
        excerpt,
        authorId: req.user.userId,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        published: true
      });

      res.success(article, 'Article created successfully');
    } catch (error) {
      res.error('Failed to create article', 400, error);
    }
  });

  // Search articles
  app.get('/search', async (req: KenxRequest, res: KenxResponse) => {
    const query = req.query.q as string;
    
    if (!query) {
      return await res.render('search', { 
        title: 'Search Articles',
        query: '',
        results: []
      });
    }

    const articles = Article.findAll({ 
      where: { published: true }
    }).filter(article => 
      article.title.toLowerCase().includes(query.toLowerCase()) ||
      article.content.toLowerCase().includes(query.toLowerCase()) ||
      article.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );

    const articlesWithAuthors = articles.map(article => ({
      ...article,
      author: User.findById(article.authorId)
    }));

    await res.render('search', {
      title: `Search Results for "${query}"`,
      query,
      results: articlesWithAuthors
    });
  });

  // API endpoints
  app.get('/api/articles', (req: KenxRequest, res: KenxResponse) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const articles = Article.findAll({
      where: { published: true },
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit,
      offset
    });

    const total = Article.findAll({ where: { published: true } }).length;

    res.paginate(articles, page, limit, total);
  });

  app.post('/api/comments', app.requireAuth(), (req: KenxRequest, res: KenxResponse) => {
    try {
      const comment = Comment.create({
        content: req.body.content,
        authorId: req.user.userId,
        articleId: req.body.articleId
      });

      const author = User.findById(comment.authorId);
      
      res.success({ ...comment, author: { username: author.username } }, 
                   'Comment posted successfully');
    } catch (error) {
      res.error('Failed to post comment', 400, error);
    }
  });
}
```

## Templates

### Main Layout (`views/layouts/main.kenx`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <header class="header">
        <nav class="nav">
            <div class="nav-brand">
                <a href="/">Kenx Blog</a>
            </div>
            <div class="nav-links">
                <a href="/">Home</a>
                <a href="/search">Search</a>
                <a href="/create">Write</a>
                <a href="/login">Login</a>
                <a href="/register">Register</a>
            </div>
        </nav>
    </header>

    <main class="main">
        {{{body}}}
    </main>

    <footer class="footer">
        <p>&copy; 2024 Kenx Blog Platform. Built with Kenx Framework.</p>
    </footer>

    <script src="/static/js/app.js"></script>
</body>
</html>
```

### Article Detail (`views/article/detail.kenx`)

```html
<article class="article-detail">
    <header class="article-header">
        <h1>{{article.title}}</h1>
        <div class="article-meta">
            <span>By {{article.author.username}}</span>
            <span>{{article.createdAt}}</span>
            {{#if article.tags.length}}
            <div class="tags">
                {{#each article.tags}}
                <span class="tag">{{this}}</span>
                {{/each}}
            </div>
            {{/if}}
        </div>
    </header>

    <div class="article-content">
        {{{article.content}}}
    </div>
</article>

<section class="comments">
    <h3>Comments ({{comments.length}})</h3>
    
    <form id="comment-form" class="comment-form">
        <textarea name="content" placeholder="Add a comment..." required></textarea>
        <button type="submit">Post Comment</button>
    </form>

    <div id="comments-list" class="comments-list">
        {{#each comments}}
        <div class="comment">
            <div class="comment-author">{{author.username}}</div>
            <div class="comment-content">{{content}}</div>
            <div class="comment-date">{{createdAt}}</div>
        </div>
        {{/each}}
    </div>
</section>

<script>
// Real-time comments with WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');
const articleId = {{article.id}};

ws.onopen = function() {
    ws.send(JSON.stringify({ type: 'join-room', room: `article-${articleId}` }));
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (data.type === 'new-comment') {
        addCommentToList(data);
    }
};

function addCommentToList(comment) {
    const commentsList = document.getElementById('comments-list');
    const commentEl = document.createElement('div');
    commentEl.className = 'comment';
    commentEl.innerHTML = `
        <div class="comment-author">${comment.author.username}</div>
        <div class="comment-content">${comment.content}</div>
        <div class="comment-date">${new Date(comment.createdAt).toLocaleString()}</div>
    `;
    commentsList.insertBefore(commentEl, commentsList.firstChild);
}

document.getElementById('comment-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const content = this.content.value.trim();
    if (!content) return;

    ws.send(JSON.stringify({
        type: 'comment',
        content: content,
        articleId: articleId,
        authorId: getCurrentUserId() // Get from auth state
    }));

    this.content.value = '';
});
</script>
```

## Styling (`public/css/style.css`)

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
    color: #333;
    background: #f8f9fa;
}

.header {
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    position: sticky;
    top: 0;
    z-index: 100;
}

.nav {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.nav-brand a {
    font-size: 1.5rem;
    font-weight: bold;
    color: #007bff;
    text-decoration: none;
}

.nav-links {
    display: flex;
    gap: 2rem;
}

.nav-links a {
    color: #666;
    text-decoration: none;
    transition: color 0.2s;
}

.nav-links a:hover {
    color: #007bff;
}

.main {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 0 2rem;
}

.article-detail {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 2rem;
}

.article-header h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: #2c3e50;
}

.article-meta {
    display: flex;
    gap: 1rem;
    align-items: center;
    color: #666;
    font-size: 0.9rem;
    margin-bottom: 2rem;
}

.tags {
    display: flex;
    gap: 0.5rem;
}

.tag {
    background: #e9ecef;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
}

.article-content {
    font-size: 1.1rem;
    line-height: 1.8;
}

.comments {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.comment-form {
    margin-bottom: 2rem;
}

.comment-form textarea {
    width: 100%;
    min-height: 100px;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    resize: vertical;
    font-family: inherit;
}

.comment-form button {
    background: #007bff;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 1rem;
    transition: background 0.2s;
}

.comment-form button:hover {
    background: #0056b3;
}

.comment {
    border-bottom: 1px solid #eee;
    padding: 1rem 0;
}

.comment:last-child {
    border-bottom: none;
}

.comment-author {
    font-weight: bold;
    color: #007bff;
    margin-bottom: 0.5rem;
}

.comment-content {
    margin-bottom: 0.5rem;
}

.comment-date {
    font-size: 0.8rem;
    color: #666;
}

.footer {
    background: #2c3e50;
    color: white;
    text-align: center;
    padding: 2rem;
    margin-top: 4rem;
}

@media (max-width: 768px) {
    .nav {
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
    }
    
    .nav-links {
        gap: 1rem;
    }
    
    .main {
        padding: 0 1rem;
    }
    
    .article-detail,
    .comments {
        padding: 1rem;
    }
    
    .article-header h1 {
        font-size: 2rem;
    }
}
```

## Running the Application

```bash
# Install dependencies
npm install bcrypt jsonwebtoken
npm install --save-dev @types/bcrypt @types/jsonwebtoken

# Build and run
npm run build
npm start
```

## Features Implemented

✅ **Full-Stack Architecture** - Complete MVC pattern  
✅ **User Authentication** - Registration, login with JWT  
✅ **Content Management** - Create, read articles  
✅ **Real-time Comments** - WebSocket-powered comments  
✅ **Search Functionality** - Full-text search  
✅ **Responsive Design** - Mobile-friendly interface  
✅ **Database ORM** - Structured data management  
✅ **Template Engine** - Dynamic HTML rendering  
✅ **Static Assets** - CSS, JavaScript, images  
✅ **API Endpoints** - REST API for frontend integration  

This example demonstrates how Kenx provides everything needed to build a complete full-stack web application without requiring additional frameworks or libraries for core functionality.

## Next Steps

- [Add File Upload](/wiki/examples/file-upload)
- [Implement Admin Panel](/wiki/examples/admin-panel)
- [Deploy to Production](/wiki/examples/deployment)

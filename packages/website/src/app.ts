import kenx, { KenxRequest, KenxResponse } from '@kenx/framework';
import { json, logger, cors } from '@kenx/framework/dist/middleware';
import { authPlugin, validationPlugin } from '@kenx/framework/dist/plugins';
import { marked } from 'marked';
import * as fs from 'fs';
import * as path from 'path';

// Create kenx app with full-stack configuration
const app = kenx({
  // Database configuration
  database: {
    type: 'json',
    path: './data/website.db.json',
    autoSave: true
  },
  
  // View engine configuration
  views: {
    engine: 'kenx', // Using custom Kenx template engine
    viewsDir: './views',
    layoutsDir: './views/layouts',
    defaultLayout: 'main'
  },
  
  // Static files
  static: {
    directory: './public',
    prefix: '/static'
  },
  
  // WebSocket configuration
  websocket: {
    enabled: true,
    path: '/realtime'
  }
});

// Global middleware
app.use(logger());
app.use(cors());
app.use(json());

// Register plugins
app.register(authPlugin);
app.register(validationPlugin);

// Database Models
let User: any = null;
let Post: any = null;

if (app.db) {
  // User model
  User = app.db.define('users', {
    name: { type: 'string', required: true },
    email: { type: 'string', required: true, unique: true },
    age: { type: 'number' },
    createdAt: { type: 'date', default: () => new Date() }
  });

  // Post model
  Post = app.db.define('posts', {
    title: { type: 'string', required: true },
    content: { type: 'string', required: true },
    authorId: { type: 'number', required: true },
    published: { type: 'boolean', default: false },
    createdAt: { type: 'date', default: () => new Date() }
  });

  console.log('✅ Database models initialized');
  
  // Seed some initial data
  const users = User.findAll();
  if (users.length === 0) {
    User.create({ name: 'John Doe', email: 'john@example.com', age: 30 });
    User.create({ name: 'Jane Smith', email: 'jane@example.com', age: 25 });
    
    Post.create({ 
      title: 'Welcome to Kenx Framework', 
      content: 'This is our first post using the Kenx framework!',
      authorId: 1,
      published: true
    });
    Post.create({ 
      title: 'Building Modern Web Apps', 
      content: 'Learn how to build modern web applications with TypeScript and Kenx.',
      authorId: 2,
      published: true
    });
    
    console.log('✅ Initial data seeded');
  }
}

// Frontend Routes
app.get('/', async (req: KenxRequest, res: KenxResponse) => {
  const posts = Post?.findAll({ where: { published: true } }) || [];
  const users = User?.findAll() || [];
  
  // Map posts with author information
  const postsWithAuthors = posts.map((post: any) => ({
    ...post,
    author: users.find((user: any) => user.id === post.authorId)
  }));
  
  await res.render('home', {
    title: 'Welcome to Kenx Website',
    posts: postsWithAuthors,
    totalPosts: posts.length
  });
});

app.get('/about', async (req: KenxRequest, res: KenxResponse) => {
  await res.render('about', {
    title: 'About Our Kenx Website',
    framework: 'Kenx',
    version: '1.0.0'
  });
});

app.get('/chat', async (req: KenxRequest, res: KenxResponse) => {
  await res.render('chat', {
    title: 'Real-time Chat - Kenx Website'
  });
});

// Wiki Routes
app.get('/wiki', async (req: KenxRequest, res: KenxResponse) => {
  console.log('🔍 Wiki route hit - /wiki');
  const wikiPath = path.join(__dirname, '../wiki/index.md');
  console.log('📁 Wiki path:', wikiPath);
  
  try {
    const content = fs.readFileSync(wikiPath, 'utf-8');    const htmlContent = marked(content);    console.log('✅ Wiki content loaded, rendering wiki template');
    console.log('📄 Template data:', { title: 'Kenx Framework Documentation', currentPage: 'index', breadcrumbs: [{ title: 'Documentation', url: '/wiki' }] });    await res.render('wiki-simple', {
      title: 'Kenx Framework Documentation',
      content: htmlContent,
      currentPage: 'index',
      breadcrumbs: [{ title: 'Documentation', url: '/wiki', active: true }]
    }, { layout: 'wiki' });
  } catch (error) {
    console.log('❌ Wiki error:', error);
    res.status(404).render('error', {
      title: 'Wiki Not Found',
      error: 'Documentation page not found'
    });
  }
});

app.get('/wiki/*', async (req: KenxRequest, res: KenxResponse) => {
  const wikiPath = (req.url || '').replace('/wiki/', '');
  const filePath = path.join(__dirname, '../wiki', wikiPath + '.md');
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const htmlContent = marked(content);
    
    // Extract title from markdown (first # heading)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : 'Documentation';
    
    // Generate breadcrumbs
    const pathParts = wikiPath.split('/');
    const breadcrumbs: Array<{ title: string; url: string; active?: boolean }> = [
      { title: 'Documentation', url: '/wiki' }
    ];
    
    let currentPath = '';
    for (const part of pathParts) {
      currentPath += (currentPath ? '/' : '') + part;
      breadcrumbs.push({
        title: part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' '),
        url: `/wiki/${currentPath}`,
        active: currentPath === wikiPath
      });
    }
      await res.render('wiki', {
      title: `${title} - Kenx Documentation`,
      content: htmlContent,
      currentPage: wikiPath,
      breadcrumbs
    }, { layout: 'wiki' });
  } catch (error) {
    res.status(404).render('error', {
      title: 'Wiki Page Not Found',
      error: `Documentation page "${wikiPath}" not found`
    });
  }
});

// API Routes
app.get('/api/v1/health', (req: KenxRequest, res: KenxResponse) => {
  res.success({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    framework: 'Kenx',
    version: '1.0.0'
  });
});

app.get('/api/v1/posts', (req: KenxRequest, res: KenxResponse) => {
  const page = parseInt(req.query?.page as string) || 1;
  const limit = parseInt(req.query?.limit as string) || 10;
  
  const posts = Post?.findAll({ where: { published: true } }) || [];
  const total = posts.length;
  const startIndex = (page - 1) * limit;
  const paginatedPosts = posts.slice(startIndex, startIndex + limit);
  
  res.paginate(paginatedPosts, page, limit, total);
});

app.post('/api/v1/posts', (req: KenxRequest, res: KenxResponse) => {
  try {
    const { title, content, authorId } = req.body;
    
    if (!title || !content || !authorId) {
      return res.error('Title, content, and authorId are required', 400);
    }
    
    const post = Post?.create({
      title,
      content,
      authorId: parseInt(authorId),
      published: true
    });
    
    res.success(post, 'Post created successfully');
  } catch (error) {
    res.error('Failed to create post', 500, error);
  }
});

// WebSocket real-time features
if (app.ws) {
  app.ws.on('connection', (client: any) => {
    console.log(`🔌 Client connected: ${client.id}`);
    app.ws!.joinRoom(client.id, 'general');
    
    app.ws!.toRoom('general', 'user-joined', {
      message: 'A new user joined the chat',
      timestamp: new Date().toISOString()
    });
  });

  app.ws.handle('chat-message', (client: any, data: any) => {
    console.log(`💬 Message from ${client.id}:`, data);
    
    app.ws!.toRoom('general', 'new-message', {
      id: Date.now(),
      message: data.message,
      sender: client.id.substring(0, 8),
      timestamp: new Date().toISOString()
    });
  });
}

// Start server
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Kenx Website running on port ${PORT}`);
  console.log(`📖 Available Routes:`);
  console.log(`   Frontend:`);
  console.log(`   GET  /                     - Homepage with posts`);
  console.log(`   GET  /about                - About page`);
  console.log(`   GET  /chat                 - Real-time chat page`);
  console.log(`   GET  /wiki                 - Wiki documentation`);
  console.log(``);
  console.log(`   API Endpoints:`);
  console.log(`   GET  /api/v1/health        - Health check`);
  console.log(`   GET  /api/v1/posts         - List posts (paginated)`);
  console.log(`   POST /api/v1/posts         - Create post`);
  console.log(``);
  console.log(`   Static Files:`);
  console.log(`   GET  /static/*             - Static file serving`);
  console.log(``);
  console.log(`   WebSocket:`);
  console.log(`   WS   /realtime             - Real-time WebSocket connection`);
  console.log(``);
  console.log(`🎯 Framework Features:`);
  console.log(`   ✅ Built-in JSON Database ORM`);
  console.log(`   ✅ Custom Template Engine`);
  console.log(`   ✅ Real-time WebSocket Support`);
  console.log(`   ✅ Static File Serving`);
  console.log(`   ✅ Plugin System`);
});

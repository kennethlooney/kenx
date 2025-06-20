import kenx, { KenxRequest, KenxResponse } from '../src/index';
import { json, logger, cors } from '../src/middleware';
import { authPlugin, validationPlugin } from '../src/plugins';
import Router from '../src/router';

// Create kenx app with full-stack configuration
const app = kenx({
  // Database configuration
  database: {
    type: 'json',
    path: './data/kenx.db.json',
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

// Database Models
if (app.db) {
  // User model
  const User = app.model('users', {
    name: { type: 'string', required: true },
    email: { type: 'string', required: true, unique: true },
    age: { type: 'number' },
    createdAt: { type: 'date', default: () => new Date() }
  });

  // Post model
  const Post = app.model('posts', {
    title: { type: 'string', required: true },
    content: { type: 'string', required: true },
    authorId: { type: 'number', required: true },
    published: { type: 'boolean', default: false },
    createdAt: { type: 'date', default: () => new Date() }
  });

  // Comment model
  const Comment = app.model('comments', {
    content: { type: 'string', required: true },
    postId: { type: 'number', required: true },
    authorId: { type: 'number', required: true },
    createdAt: { type: 'date', default: () => new Date() }
  });

  console.log('✅ Database models initialized');
}

// WebSocket real-time features
if (app.ws) {
  // Handle WebSocket connections
  app.ws.on('connection', (client) => {
    console.log(`🔌 Client connected: ${client.id}`);
    
    // Join general room
    app.ws!.joinRoom(client.id, 'general');
    
    // Notify others about new connection
    app.ws!.toRoom('general', 'user-joined', {
      message: 'A new user joined the chat',
      timestamp: new Date().toISOString()
    });
  });

  // Handle chat messages
  app.ws.handle('chat-message', (client, data) => {
    console.log(`💬 Message from ${client.id}:`, data);
    
    // Broadcast to all clients in room
    app.ws!.toRoom('general', 'new-message', {
      id: Date.now(),
      message: data.message,
      sender: client.id,
      timestamp: new Date().toISOString()
    });
  });

  // Handle post updates (real-time notifications)
  app.ws.handle('subscribe-posts', (client, data) => {
    app.ws!.joinRoom(client.id, 'posts');
    app.ws!.send(client, 'subscribed', { room: 'posts' });
  });

  console.log('✅ WebSocket server initialized');
}

// Kenx Hook System - Unique Feature
app.hook('before:request', (req: KenxRequest) => {
  console.log(`🔗 [${req.context.requestId}] Starting request to ${req.method} ${req.url}`);
});

app.hook('after:response', (req: KenxRequest, res: KenxResponse) => {
  const duration = Date.now() - req.context.startTime;
  console.log(`✅ [${req.context.requestId}] Completed in ${duration}ms`);
});

app.hook('error', (error: Error, req: KenxRequest) => {
  console.error(`❌ [${req.context.requestId}] Error:`, error.message);
});

// Register plugins
app.register(authPlugin, { secret: 'my-secret-key' });
app.register(validationPlugin);

// Global middleware
app.use(logger('combined'));
app.use(cors());
app.use(json());

// Frontend Routes - Full-stack web pages
app.get('/', async (req: KenxRequest, res: KenxResponse) => {
  try {
    const posts = app.db ? app.db.findAll('posts', { 
      where: { published: true },
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit: 10 
    }) : [];
    
    await res.render('home', {
      title: 'Welcome to Kenx Framework',
      posts,
      requestId: req.context.requestId
    });
  } catch (error) {
    res.error('Error loading homepage', 500, error);
  }
});

app.get('/chat', async (req: KenxRequest, res: KenxResponse) => {
  await res.render('chat', {
    title: 'Real-time Chat - Kenx Framework',
    wsUrl: '/realtime'
  });
});

app.get('/dashboard', async (req: KenxRequest, res: KenxResponse) => {
  try {
    const stats = {
      users: app.db ? app.db.findAll('users').length : 0,
      posts: app.db ? app.db.findAll('posts').length : 0,
      comments: app.db ? app.db.findAll('comments').length : 0,
      wsConnections: app.ws ? app.ws.getStats().totalClients : 0
    };
    
    await res.render('dashboard', {
      title: 'Dashboard - Kenx Framework',
      stats
    });
  } catch (error) {
    res.error('Error loading dashboard', 500, error);
  }
});

// API Routes - RESTful backend
const apiRouter = new Router({ prefix: '/api/v1' });

// Health check
apiRouter.get('/health', (req: KenxRequest, res: KenxResponse) => {
  res.success({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: !!app.db,
    websocket: !!app.ws,
    requestId: req.context.requestId
  });
});

// Users API
apiRouter.get('/users', async (req: KenxRequest, res: KenxResponse) => {
  if (!app.db) {
    return res.error('Database not configured', 500);
  }
  
  const page = parseInt(req.query?.page as string) || 1;
  const limit = parseInt(req.query?.limit as string) || 10;
  const offset = (page - 1) * limit;
  
  const users = app.db.findAll('users', { limit, offset });
  const total = app.db.findAll('users').length;
  
  res.paginate(users, page, limit, total);
});

apiRouter.post('/users', async (req: KenxRequest, res: KenxResponse) => {
  if (!app.db) {
    return res.error('Database not configured', 500);
  }
  
  if (!req.validate({
    name: { required: true, type: 'string' },
    email: { required: true, type: 'string' },
    age: { type: 'number' }
  })) {
    return res.error('Invalid user data', 400);
  }
  
  try {
    const sanitizedData = req.sanitize(req.body);
    const user = app.db.insert('users', sanitizedData);
    
    res.success(user, 'User created successfully');
  } catch (error) {
    res.error('Error creating user', 400, error);
  }
});

// Posts API
apiRouter.get('/posts', async (req: KenxRequest, res: KenxResponse) => {
  if (!app.db) {
    return res.error('Database not configured', 500);
  }
  
  const published = req.query?.published === 'true';
  const page = parseInt(req.query?.page as string) || 1;
  const limit = parseInt(req.query?.limit as string) || 10;
  const offset = (page - 1) * limit;
  
  const posts = app.db.findAll('posts', {
    where: published ? { published: true } : undefined,
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit,
    offset
  });
  
  const total = app.db.findAll('posts', {
    where: published ? { published: true } : undefined
  }).length;
  
  res.paginate(posts, page, limit, total);
});

apiRouter.post('/posts', async (req: KenxRequest, res: KenxResponse) => {
  if (!app.db) {
    return res.error('Database not configured', 500);
  }
  
  if (!req.validate({
    title: { required: true, type: 'string' },
    content: { required: true, type: 'string' },
    authorId: { required: true, type: 'number' }
  })) {
    return res.error('Invalid post data', 400);
  }
  
  try {
    const sanitizedData = req.sanitize(req.body);
    const post = app.db.insert('posts', sanitizedData);
    
    // Broadcast new post to WebSocket subscribers
    if (app.ws) {
      app.ws.toRoom('posts', 'new-post', {
        message: 'A new post was created',
        post,
        timestamp: new Date().toISOString()
      });
    }
    
    res.success(post, 'Post created successfully');
  } catch (error) {
    res.error('Error creating post', 400, error);
  }
});

// Real-time features API
apiRouter.get('/realtime/stats', (req: KenxRequest, res: KenxResponse) => {
  if (!app.ws) {
    return res.error('WebSocket not enabled', 500);
  }
  
  res.success(app.ws.getStats(), 'WebSocket statistics');
});

apiRouter.post('/realtime/broadcast', (req: KenxRequest, res: KenxResponse) => {
  if (!app.ws) {
    return res.error('WebSocket not enabled', 500);
  }
  
  const { message, room } = req.body;
  
  if (room) {
    app.ws.toRoom(room, 'broadcast', { message, timestamp: new Date().toISOString() });
  } else {
    app.ws.broadcast('broadcast', { message, timestamp: new Date().toISOString() });
  }
  
  res.success({ broadcasted: true }, 'Message broadcasted');
});

// Apply API router
apiRouter.applyTo(app);

// Error handling
app.on('error', (error) => {
  console.error('🚨 Application error:', error);
});

// Seed some initial data
if (app.db) {
  setTimeout(() => {
    // Create sample users
    const users = app.db!.findAll('users');
    if (users.length === 0) {
      app.db!.insert('users', { name: 'John Doe', email: 'john@example.com', age: 30 });
      app.db!.insert('users', { name: 'Jane Smith', email: 'jane@example.com', age: 25 });
      console.log('✅ Sample users created');
    }
    
    // Create sample posts
    const posts = app.db!.findAll('posts');
    if (posts.length === 0) {
      app.db!.insert('posts', {
        title: 'Welcome to Kenx Framework',
        content: 'This is a full-stack Node.js framework with built-in database, views, and WebSocket support.',
        authorId: 1,
        published: true
      });
      
      app.db!.insert('posts', {
        title: 'Real-time Features',
        content: 'Kenx comes with built-in WebSocket support for real-time applications.',
        authorId: 2,
        published: true
      });
      
      console.log('✅ Sample posts created');
    }
  }, 100);
}

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`🚀 Kenx Full-Stack Server running on port ${PORT}`);
  console.log(`\n📖 Available Routes:`);
  console.log(`   Frontend:`);
  console.log(`   GET  /                     - Homepage with posts`);
  console.log(`   GET  /chat                 - Real-time chat page`);
  console.log(`   GET  /dashboard            - Statistics dashboard`);
  console.log(`   \n   API Endpoints:`);
  console.log(`   GET  /api/v1/health        - Health check`);
  console.log(`   GET  /api/v1/users         - List users (paginated)`);
  console.log(`   POST /api/v1/users         - Create user`);
  console.log(`   GET  /api/v1/posts         - List posts (paginated)`);
  console.log(`   POST /api/v1/posts         - Create post`);
  console.log(`   GET  /api/v1/realtime/stats - WebSocket statistics`);
  console.log(`   POST /api/v1/realtime/broadcast - Broadcast message`);
  console.log(`   \n   Static Files:`);
  console.log(`   GET  /static/*             - Static file serving`);
  console.log(`   \n   WebSocket:`);
  console.log(`   WS   /realtime             - Real-time WebSocket connection`);
  console.log(`\n🎯 Framework Features:`);
  console.log(`   ✅ Built-in JSON Database ORM`);
  console.log(`   ✅ Custom Template Engine`);
  console.log(`   ✅ Real-time WebSocket Support`);
  console.log(`   ✅ Request Hooks & Lifecycle Events`);
  console.log(`   ✅ Enhanced Response Helpers`);
  console.log(`   ✅ Request Context & Tracing`);
  console.log(`   ✅ Built-in Validation & Sanitization`);
  console.log(`   ✅ Static File Serving`);
  console.log(`   ✅ Plugin System`);
});

import kenx, { KenxRequest, KenxResponse } from '../src/index';
import { json, logger, cors } from '../src/middleware';
import { authPlugin, validationPlugin } from '../src/plugins';
import Router from '../src/router';

// Create kenx app
const app = kenx();

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

// Basic routes - Using Kenx's enhanced response helpers
app.get('/', (req: KenxRequest, res: KenxResponse) => {
  // Store some context metadata
  req.context.metadata.feature = 'welcome';
  
  res.success({
    message: 'Welcome to Kenx Framework!',
    version: '1.0.0',
    requestId: req.context.requestId,
    features: [
      'Hook system for lifecycle events',
      'Built-in request context',
      'Enhanced response helpers',
      'TypeScript-first design',
      'Plugin architecture'
    ]
  }, 'Framework information retrieved');
});

app.get('/health', (req: KenxRequest, res: KenxResponse) => {
  const uptime = process.uptime();
  res.success({
    status: 'healthy',
    uptime: `${Math.floor(uptime)} seconds`,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Route with parameters - showcasing kenx's built-in validation
app.get('/users/:id', (req: KenxRequest, res: KenxResponse) => {
  const { id } = req.params!;
  
  // Built-in validation
  if (!req.validate({ id: { required: true, type: 'string' } })) {
    return res.error('Invalid user ID format', 400);
  }
  
  req.context.metadata.userId = id;
  res.success({
    user: { 
      id, 
      name: `User ${id}`, 
      email: `user${id}@example.com`,
      requestContext: req.context.requestId
    }
  }, `User ${id} retrieved successfully`);
});

// Protected route using auth plugin
app.get('/protected', (app as any).requireAuth(), (req: KenxRequest, res: KenxResponse) => {
  res.success({
    message: 'Access granted to protected resource',
    user: 'authenticated-user',
    accessTime: new Date().toISOString()
  }, 'Protected resource accessed');
});

// Route with validation and sanitization
app.post('/users', (app as any).validate({
  name: { required: true, type: 'string', minLength: 2 },
  email: { required: true, type: 'string' },
  age: { type: 'number' }
}), (req: KenxRequest, res: KenxResponse) => {
  // Sanitize input data
  const sanitizedData = req.sanitize(req.body);
  const { name, email, age } = sanitizedData;
  
  const newUser = { 
    id: Date.now(), 
    name, 
    email, 
    age,
    createdAt: new Date().toISOString(),
    requestId: req.context.requestId
  };
  
  res.success(newUser, 'User created successfully');
});

// Router example - using enhanced kenx features
const apiRouter = new Router({ prefix: '/api/v1' });

apiRouter.get('/status', (req: KenxRequest, res: KenxResponse) => {
  res.success({ 
    api: 'v1', 
    status: 'active',
    requestId: req.context.requestId,
    serverTime: new Date().toISOString()
  });
});

apiRouter.post('/data', (req: KenxRequest, res: KenxResponse) => {
  const sanitizedData = req.sanitize(req.body);
  res.success({
    message: 'Data processed successfully',
    receivedData: sanitizedData,
    processedAt: new Date().toISOString()
  });
});

// Paginated endpoint example
apiRouter.get('/posts', (req: KenxRequest, res: KenxResponse) => {
  const page = parseInt(req.query?.page as string) || 1;
  const limit = parseInt(req.query?.limit as string) || 10;
  
  // Mock data
  const posts = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    title: `Post ${i + 1}`,
    content: `This is post number ${i + 1}`
  }));
  
  const start = (page - 1) * limit;
  const paginatedPosts = posts.slice(start, start + limit);
  
  res.paginate(paginatedPosts, page, limit, posts.length);
});

// Resource routing example
const userController = {
  index: (req: KenxRequest, res: KenxResponse) => {
    const users = [
      { id: 1, name: 'John', email: 'john@example.com' }, 
      { id: 2, name: 'Jane', email: 'jane@example.com' }
    ];
    res.success(users, 'Users retrieved successfully');
  },
  show: (req: KenxRequest, res: KenxResponse) => {
    const { id } = req.params!;
    res.success({ 
      user: { id, name: `User ${id}`, email: `user${id}@example.com` }
    }, `User ${id} details retrieved`);
  },
  create: (req: KenxRequest, res: KenxResponse) => {
    const userData = req.sanitize(req.body);
    res.success({ 
      message: 'User created successfully', 
      user: { ...userData, id: Date.now(), createdAt: new Date().toISOString() }
    });
  },
  update: (req: KenxRequest, res: KenxResponse) => {
    const { id } = req.params!;
    const userData = req.sanitize(req.body);
    res.success({ 
      message: `User ${id} updated successfully`, 
      user: { ...userData, id, updatedAt: new Date().toISOString() }
    });
  },
  destroy: (req: KenxRequest, res: KenxResponse) => {
    const { id } = req.params!;
    res.success(null, `User ${id} deleted successfully`);
  }
};

apiRouter.resource('users', userController);

// Apply router to app
apiRouter.applyTo(app);

// Error handling
app.on('error', (error) => {
  console.error('Application error:', error);
});

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`🚀 Kenx server is running on port ${PORT}`);
  console.log(`📖 Kenx Framework Features Demonstrated:`);
  console.log(`   🔗 Hook system for request lifecycle`);
  console.log(`   📝 Request context and metadata tracking`);
  console.log(`   ✨ Enhanced response helpers (success/error/paginate)`);
  console.log(`   🛡️ Built-in validation and sanitization`);
  console.log(`   🔌 Plugin architecture`);
  console.log(`\n📚 API Endpoints:`);
  console.log(`   GET  /                    - Welcome with kenx features`);
  console.log(`   GET  /health              - Health check with system info`);
  console.log(`   GET  /users/:id           - User details with validation`);
  console.log(`   GET  /protected           - Protected route (Bearer token)`);
  console.log(`   POST /users               - Create user with validation`);
  console.log(`   GET  /api/v1/status       - API status with context`);
  console.log(`   POST /api/v1/data         - Data processing with sanitization`);
  console.log(`   GET  /api/v1/posts        - Paginated posts (?page=1&limit=5)`);
  console.log(`   GET  /api/v1/users        - List all users`);
  console.log(`   GET  /api/v1/users/:id    - Get user by ID`);
  console.log(`   POST /api/v1/users        - Create new user`);
  console.log(`   PUT  /api/v1/users/:id    - Update user`);
  console.log(`   DELETE /api/v1/users/:id  - Delete user`);
  console.log(`\n🔑 Try these examples:`);
  console.log(`   curl http://localhost:${PORT}/`);
  console.log(`   curl http://localhost:${PORT}/api/v1/posts?page=2&limit=5`);
  console.log(`   curl -H "Authorization: Bearer my-secret-key" http://localhost:${PORT}/protected`);
});

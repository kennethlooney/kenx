# Routing

Kenx provides a powerful and flexible routing system similar to Express.js, with additional features for full-stack development.

## Basic Routing

Define routes using HTTP methods:

```typescript
import kenx from '@kenx/framework';

const app = kenx();

// Basic routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.post('/users', (req, res) => {
  // Create user logic
  res.json({ success: true });
});

app.put('/users/:id', (req, res) => {
  const id = req.params.id;
  // Update user logic
  res.json({ id, updated: true });
});

app.delete('/users/:id', (req, res) => {
  const id = req.params.id;
  // Delete user logic
  res.json({ id, deleted: true });
});
```

## Route Parameters

Extract dynamic values from URLs:

```typescript
// Single parameter
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ userId });
});

// Multiple parameters
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
});

// Optional parameters
app.get('/posts/:id?', (req, res) => {
  const id = req.params.id;
  if (id) {
    res.json({ post: id });
  } else {
    res.json({ posts: 'all' });
  }
});
```

## Query Parameters

Access query string parameters:

```typescript
app.get('/search', (req, res) => {
  const query = req.query.q;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  
  res.json({
    query,
    page,
    limit,
    results: []
  });
});

// URL: /search?q=kenx&page=2&limit=20
```

## Route Handlers

Routes can have multiple handler functions:

```typescript
// Middleware function
const authenticate = (req, res, next) => {
  // Check authentication
  if (req.headers.authorization) {
    next(); // Continue to next handler
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Route with middleware
app.get('/protected', authenticate, (req, res) => {
  res.json({ message: 'Access granted' });
});

// Multiple middleware
app.get('/admin', authenticate, checkAdmin, (req, res) => {
  res.json({ message: 'Admin access' });
});
```

## Request and Response Objects

### Request Object

```typescript
app.post('/example', (req, res) => {
  // Route parameters
  const id = req.params.id;
  
  // Query parameters
  const search = req.query.search;
  
  // Request body
  const data = req.body;
  
  // Headers
  const contentType = req.headers['content-type'];
  
  // HTTP method
  const method = req.method;
  
  // URL
  const url = req.url;
  
  res.json({
    id, search, data, contentType, method, url
  });
});
```

### Response Object

```typescript
app.get('/response-examples', (req, res) => {
  // JSON response
  res.json({ message: 'Hello' });
  
  // Set status code
  res.status(404).json({ error: 'Not found' });
  
  // Send plain text
  res.send('Hello World');
  
  // Success helper
  res.success({ data: 'value' }, 'Operation successful');
  
  // Error helper
  res.error('Something went wrong', 500);
  
  // Paginated response
  res.paginate(items, page, limit, total);
});
```

## Template Rendering

Render HTML templates:

```typescript
app.get('/profile/:id', async (req, res) => {
  const userId = req.params.id;
  const user = await User.findById(userId);
  
  if (!user) {
    return res.status(404).render('error', { 
      title: 'User Not Found',
      error: 'User does not exist' 
    });
  }
  
  await res.render('profile', {
    title: 'User Profile',
    user
  });
});
```

## Error Handling

Handle errors in routes:

```typescript
app.get('/error-example', async (req, res) => {
  try {
    // Some async operation
    const data = await riskyOperation();
    res.json(data);
  } catch (error) {
    console.error('Route error:', error);
    res.error('Internal server error', 500, error);
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ 
    error: 'Something went wrong',
    details: err.message 
  });
});
```

## Advanced Routing

### Route Groups

Organize related routes:

```typescript
// API routes
app.get('/api/v1/users', getAllUsers);
app.post('/api/v1/users', createUser);
app.get('/api/v1/users/:id', getUser);
app.put('/api/v1/users/:id', updateUser);
app.delete('/api/v1/users/:id', deleteUser);

// Admin routes
app.get('/admin/dashboard', adminDashboard);
app.get('/admin/users', adminUsers);
app.get('/admin/settings', adminSettings);
```

### Wildcard Routes

Catch-all routes:

```typescript
// Catch all unmatched routes
app.get('*', (req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    url: req.url
  });
});
```

## Best Practices

1. **Use descriptive route names**
2. **Keep route handlers small**
3. **Use middleware for common functionality**
4. **Handle errors properly**
5. **Validate input parameters**
6. **Use proper HTTP status codes**

## Next Steps

- [Learn about Middleware](/wiki/api/middleware)
- [Explore Database Integration](/wiki/api/database)
- [Template Rendering](/wiki/api/templates)

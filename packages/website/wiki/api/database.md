# Database ORM

Kenx includes a powerful built-in database ORM that provides a simple yet flexible way to work with data without requiring external dependencies like Sequelize or TypeORM.

## Configuration

Configure the database when creating your Kenx app:

```typescript
import kenx from '@kenx/framework';

const app = kenx({
  database: {
    type: 'json',           // 'json' or 'memory'
    path: './data/app.db.json',  // File path for JSON storage
    autoSave: true          // Auto-save changes to file
  }
});
```

### Database Types

- **JSON Storage**: Persists data to a JSON file
- **Memory Storage**: Keeps data in memory (lost on restart)

## Defining Models

Define data models with schemas:

```typescript
// Define a User model
const User = app.db.define('users', {
  name: { 
    type: 'string', 
    required: true 
  },
  email: { 
    type: 'string', 
    required: true, 
    unique: true 
  },
  age: { 
    type: 'number' 
  },
  active: { 
    type: 'boolean', 
    default: true 
  },
  createdAt: { 
    type: 'date', 
    default: () => new Date() 
  }
});
```

### Schema Types

- `string` - Text data
- `number` - Numeric data
- `boolean` - True/false values
- `date` - Date objects
- `object` - Complex objects
- `array` - Array data

### Schema Options

- `required: true` - Field is mandatory
- `unique: true` - Field must be unique
- `default: value` - Default value (can be a function)
- `validate: function` - Custom validation function

## CRUD Operations

### Creating Records

```typescript
// Create a single user
const user = User.create({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

console.log(user.id); // Auto-generated ID
```

### Reading Records

```typescript
// Find all users
const allUsers = User.findAll();

// Find with conditions
const activeUsers = User.findAll({
  where: { active: true }
});

// Find one user
const user = User.findOne({
  where: { email: 'john@example.com' }
});

// Find by ID
const userById = User.findById(1);

// Find with ordering
const sortedUsers = User.findAll({
  orderBy: { field: 'createdAt', direction: 'desc' }
});

// Find with pagination
const paginatedUsers = User.findAll({
  limit: 10,
  offset: 20
});
```

### Updating Records

```typescript
// Update by ID
const updatedUser = User.update(1, {
  name: 'John Smith',
  age: 31
});

// Update multiple (using direct database methods)
app.db.updateWhere('users', 
  { active: false }, 
  { active: true }
);
```

### Deleting Records

```typescript
// Delete by ID
const deleted = User.delete(1);

// Delete with conditions
app.db.deleteWhere('users', { active: false });
```

## Query Options

All find methods support query options:

```typescript
const users = User.findAll({
  where: {
    age: { $gt: 18 },          // Greater than
    active: true,
    name: { $like: 'John%' }   // Starts with "John"
  },
  orderBy: { 
    field: 'createdAt', 
    direction: 'desc' 
  },
  limit: 10,
  offset: 0
});
```

### Query Operators

- `$gt` - Greater than
- `$gte` - Greater than or equal
- `$lt` - Less than
- `$lte` - Less than or equal
- `$ne` - Not equal
- `$like` - String contains (case-insensitive)
- `$in` - Value in array
- `$notIn` - Value not in array

## Model Methods

Models provide convenient methods:

```typescript
// Count records
const totalUsers = User.count();

// Check if exists
const exists = User.findOne({ where: { email: 'test@example.com' } });

// Get by field
const usersByAge = User.where({ age: 25 });

// Ordered results
const recentUsers = User.orderBy('createdAt', 'desc');

// Limited results
const firstTen = User.limit(10);
```

## Database Events

Listen to database events:

```typescript
app.db.on('create', (tableName, record) => {
  console.log(`New ${tableName} created:`, record);
});

app.db.on('update', (tableName, id, changes) => {
  console.log(`${tableName} ${id} updated:`, changes);
});

app.db.on('delete', (tableName, id) => {
  console.log(`${tableName} ${id} deleted`);
});
```

## Validation

Add custom validation to models:

```typescript
const Product = app.db.define('products', {
  name: { 
    type: 'string', 
    required: true,
    validate: (value) => value.length >= 3
  },
  price: { 
    type: 'number', 
    required: true,
    validate: (value) => value > 0
  },
  category: {
    type: 'string',
    validate: (value) => ['electronics', 'books', 'clothing'].includes(value)
  }
});
```

## Relationships

While Kenx doesn't have automatic relationships, you can implement them manually:

```typescript
// User model
const User = app.db.define('users', {
  name: { type: 'string', required: true },
  email: { type: 'string', required: true, unique: true }
});

// Post model with foreign key
const Post = app.db.define('posts', {
  title: { type: 'string', required: true },
  content: { type: 'string', required: true },
  authorId: { type: 'number', required: true }
});

// Find posts with authors
const postsWithAuthors = Post.findAll().map(post => {
  const author = User.findById(post.authorId);
  return { ...post, author };
});
```

## Best Practices

1. **Define schemas clearly** with proper types and validation
2. **Use transactions** for multiple related operations
3. **Index frequently queried fields** (unique constraint helps)
4. **Validate data** before saving
5. **Handle errors** appropriately
6. **Use pagination** for large datasets
7. **Regular backups** for JSON storage

## Example: Complete User Management

```typescript
import kenx from '@kenx/framework';

const app = kenx({
  database: {
    type: 'json',
    path: './data/users.db.json',
    autoSave: true
  }
});

// Define User model with validation
const User = app.db.define('users', {
  name: { type: 'string', required: true },
  email: { 
    type: 'string', 
    required: true, 
    unique: true,
    validate: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  },
  age: { 
    type: 'number',
    validate: (age) => age >= 0 && age <= 120
  },
  active: { type: 'boolean', default: true },
  createdAt: { type: 'date', default: () => new Date() }
});

// API endpoints
app.get('/users', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;
  
  const users = User.findAll({ 
    where: { active: true },
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit,
    offset
  });
  
  const total = User.count();
  
  res.paginate(users, page, limit, total);
});

app.post('/users', (req, res) => {
  try {
    const user = User.create(req.body);
    res.success(user, 'User created successfully');
  } catch (error) {
    res.error('Failed to create user', 400, error);
  }
});

app.put('/users/:id', (req, res) => {
  try {
    const user = User.update(req.params.id, req.body);
    if (!user) {
      return res.error('User not found', 404);
    }
    res.success(user, 'User updated successfully');
  } catch (error) {
    res.error('Failed to update user', 400, error);
  }
});

app.delete('/users/:id', (req, res) => {
  const deleted = User.delete(req.params.id);
  if (!deleted) {
    return res.error('User not found', 404);
  }
  res.success(null, 'User deleted successfully');
});

app.listen(3000);
```

## Next Steps

- [Learn about Templates](/wiki/api/templates)
- [Explore WebSocket Features](/wiki/api/websocket)
- [Build a Full-Stack App](/wiki/examples/fullstack-app)

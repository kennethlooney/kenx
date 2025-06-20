# Your First Kenx App

Let's build a complete full-stack application with Kenx that demonstrates the key features of the framework.

## Basic Application Structure

Create a new directory for your app:

```bash
mkdir my-kenx-app
cd my-kenx-app
npm init -y
npm install @kenx/framework
```

## Creating the Main Application

Create `app.ts`:

```typescript
import kenx from '@kenx/framework';

// Create app with full-stack configuration
const app = kenx({
  // Built-in database
  database: {
    type: 'json',
    path: './data/app.db.json',
    autoSave: true
  },
  
  // Template engine
  views: {
    engine: 'kenx',
    viewsDir: './views',
    defaultLayout: 'main'
  },
  
  // Static files
  static: {
    directory: './public',
    prefix: '/static'
  }
});

// Define a User model
const User = app.db.define('users', {
  name: { type: 'string', required: true },
  email: { type: 'string', required: true, unique: true },
  createdAt: { type: 'date', default: () => new Date() }
});

// Routes
app.get('/', async (req, res) => {
  const users = User.findAll();
  await res.render('home', { 
    title: 'My Kenx App',
    users 
  });
});

app.get('/api/users', (req, res) => {
  const users = User.findAll();
  res.json(users);
});

app.post('/api/users', (req, res) => {
  try {
    const user = User.create(req.body);
    res.success(user, 'User created successfully');
  } catch (error) {
    res.error('Failed to create user', 400);
  }
});

app.listen(3000, () => {
  console.log('🚀 App running on port 3000');
});
```

## Creating Templates

Create the directory structure:

```bash
mkdir views
mkdir views/layouts
mkdir public
mkdir data
```

Create `views/layouts/main.kenx`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}} | My Kenx App</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .user-list { list-style: none; padding: 0; }
        .user-list li { padding: 10px; border: 1px solid #ddd; margin: 5px 0; }
    </style>
</head>
<body>
    <header>
        <h1>{{title}}</h1>
    </header>
    
    <main>
        {{{body}}}
    </main>
</body>
</html>
```

Create `views/home.kenx`:

```html
<h2>Welcome to your Kenx App!</h2>

<h3>Users</h3>
{{#if users.length}}
    <ul class="user-list">
    {{#each users}}
        <li>
            <strong>{{name}}</strong> - {{email}}
            <small>(Created: {{createdAt}})</small>
        </li>
    {{/each}}
    </ul>
{{else}}
    <p>No users found. <a href="/api/users" target="_blank">Check the API</a></p>
{{/if}}

<h3>Add User</h3>
<form id="userForm">
    <input type="text" id="name" placeholder="Name" required>
    <input type="email" id="email" placeholder="Email" required>
    <button type="submit">Add User</button>
</form>

<script>
document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email })
        });
        
        if (response.ok) {
            location.reload();
        } else {
            alert('Error creating user');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});
</script>
```

## Running Your App

```bash
npx ts-node app.ts
```

Visit `http://localhost:3000` to see your app in action!

## What You've Built

This example demonstrates:

✅ **Database ORM** - User model with validation  
✅ **Template Engine** - Dynamic HTML rendering  
✅ **REST API** - JSON endpoints  
✅ **Static Files** - CSS and assets  
✅ **Form Handling** - Create new users  

## Next Steps

- [Learn about Routing](/wiki/api/routing)
- [Explore the Database ORM](/wiki/api/database)
- [Add WebSocket Support](/wiki/api/websocket)

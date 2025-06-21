# Kenx Web Application Framework

A modern, lightweight Node.js web framework built with TypeScript, featuring a monorepo structure with the framework and a demo website.

## ���️ Monorepo Structure

```
kenx/
├── packages/
│   ├── framework/          # The Kenx framework package
│   │   ├── src/           # Framework source code
│   │   ├── examples/      # Framework usage examples
│   │   ├── tests/         # Framework tests
│   │   └── dist/          # Built framework (after npm run build)
│   └── website/           # Demo website using Kenx
│       ├── src/           # Website application code
│       ├── views/         # Website templates
│       ├── public/        # Static assets
│       └── data/          # Website database
├── package.json           # Monorepo configuration
└── README.md              # This file
```

## 🚀 Quick Start

### 🔮 Coming Soon: CLI Generator!

> **📝 Next Major Feature**: We're building a CLI tool to make project creation super easy:
>
> ```bash
> npx create-kenx-app my-app
> # Choose: Full-Stack, API Backend, or Frontend Client
> ```
>
> For now, follow the manual setup below or check the [examples](packages/framework/examples/).

### Prerequisites
- Node.js 16+ 
- npm 7+ (for workspace support)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd kenx

# Install all dependencies for all packages
npm install

# Build the framework
npm run build

# Start the demo website
npm run start:website
```

## ��� Packages

### @kenx/framework
The core Kenx framework package providing:
- 🏗️ **TypeScript-first** - Built with TypeScript for excellent developer experience
- 🔄 **Middleware-based** - Express-like middleware pattern
- 🧩 **Plugin system** - Extensible architecture with plugins
- 🗄️ **Built-in database** - Simple JSON-based database with ORM-like interface
- 🎨 **Template engine** - Custom template engine with layouts
- ⚡ **WebSocket support** - Real-time features out of the box
- 📁 **Static file serving** - Built-in static file server
- 🔐 **Authentication** - JWT, sessions, role-based access control
- 🛡️ **Security** - CORS, CSRF, rate limiting, security headers
- 🔗 **Frontend/Backend Separation** - API-only or full-stack deployment

### @kenx/website
A full-featured demo website showcasing Kenx framework capabilities:
- ��� **Homepage** - Dynamic content with database integration
- ��� **Real-time chat** - WebSocket-powered chat application
- ��� **REST API** - JSON API endpoints
- ��� **Responsive design** - Modern, mobile-friendly interface

## ���️ Development Commands

### Root Level Commands
```bash
# Install dependencies for all packages
npm install

# Build all packages
npm run build

# Build specific package
npm run build --workspace=@kenx/framework
npm run build --workspace=@kenx/website

# Run tests for all packages
npm run test

# Start the demo website
npm run start:website
```

### Framework Package Commands
```bash
cd packages/framework

# Build the framework
npm run build

# Run tests
npm run test

# Run linting
npm run lint

# Start development mode
npm run dev
```

### Website Package Commands
```bash
cd packages/website

# Build the website
npm run build

# Start the website
npm run start

# Development mode with auto-reload
npm run dev
```

## ��� Framework Features

### Core Framework
- **Routing**: Express-like routing with middleware support
- **Request/Response**: Enhanced request and response objects
- **Error handling**: Comprehensive error handling
- **Hooks**: Extensible hook system

### Database
- **ORM-like interface**: Simple and intuitive database operations
- **JSON storage**: File-based JSON database
- **Model definitions**: Schema-based model definitions
- **Query builder**: Flexible query building

### WebSocket
- **Real-time communication**: Built-in WebSocket server
- **Room management**: Client grouping and broadcasting
- **Event handling**: Custom event system
- **Client management**: Connection lifecycle management

### Plugin System
- **Extensible**: Easy plugin development
- **Built-in plugins**: Authentication, validation, and more
- **Lifecycle hooks**: Plugin installation and management

## ��� Usage Examples

### Basic Application
```typescript
import kenx from '@kenx/framework';

const app = kenx();

app.get('/', (req, res) => {
  res.json({ message: 'Hello, Kenx!' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### With Database
```typescript
import kenx from '@kenx/framework';

const app = kenx({
  database: {
    type: 'json',
    path: './data/app.db.json',
    autoSave: true
  }
});

// Define models
const User = app.db.define('users', {
  name: { type: 'string', required: true },
  email: { type: 'string', required: true, unique: true }
});

app.get('/users', (req, res) => {
  const users = User.findAll();
  res.json(users);
});
```

## ��� Testing

The framework includes comprehensive tests:

```bash
# Run all tests
npm run test

# Run tests for specific package
npm run test --workspace=@kenx/framework

# Run tests in watch mode
npm run test:watch
```

## ��� Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run tests and ensure they pass
6. Submit a pull request

## ��� License

MIT License - see LICENSE file for details.

## ��� Links

- [Framework Documentation](packages/framework/README.md)
- [Website Demo](packages/website/README.md)
- [Examples](packages/framework/examples/)

---

Built with ❤️ and TypeScript

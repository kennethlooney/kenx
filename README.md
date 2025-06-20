# Kenx Framework Monorepo

A modern, lightweight Node.js web framework built with TypeScript, featuring a monorepo structure with the framework and a demo website.

## í¿—ï¸ Monorepo Structure

```
kenx/
â”œâ”€â”€ packages/
â”‚   â”œâ”€â”€ framework/          # The Kenx framework package
â”‚   â”‚   â”œâ”€â”€ src/           # Framework source code
â”‚   â”‚   â”œâ”€â”€ examples/      # Framework usage examples
â”‚   â”‚   â”œâ”€â”€ tests/         # Framework tests
â”‚   â”‚   â””â”€â”€ dist/          # Built framework (after npm run build)
â”‚   â””â”€â”€ website/           # Demo website using Kenx
â”‚       â”œâ”€â”€ src/           # Website application code
â”‚       â”œâ”€â”€ views/         # Website templates
â”‚       â”œâ”€â”€ public/        # Static assets
â”‚       â””â”€â”€ data/          # Website database
â”œâ”€â”€ package.json           # Monorepo configuration
â””â”€â”€ README.md              # This file
```

## íº€ Quick Start

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

## í³¦ Packages

### @kenx/framework
The core Kenx framework package providing:
- í» ï¸ **TypeScript-first** - Built with TypeScript for excellent developer experience
- í´€ **Middleware-based** - Express-like middleware pattern
- í´Œ **Plugin system** - Extensible architecture with plugins
- í·„ï¸ **Built-in database** - Simple JSON-based database with ORM-like interface
- í¾¨ **Template engine** - Custom template engine with layouts
- âš¡ **WebSocket support** - Real-time features out of the box
- í³ **Static file serving** - Built-in static file server

### @kenx/website
A full-featured demo website showcasing Kenx framework capabilities:
- í¿  **Homepage** - Dynamic content with database integration
- í²¬ **Real-time chat** - WebSocket-powered chat application
- í´Œ **REST API** - JSON API endpoints
- í³± **Responsive design** - Modern, mobile-friendly interface

## í» ï¸ Development Commands

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

## í¼Ÿ Framework Features

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

## í³š Usage Examples

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

## í·ª Testing

The framework includes comprehensive tests:

```bash
# Run all tests
npm run test

# Run tests for specific package
npm run test --workspace=@kenx/framework

# Run tests in watch mode
npm run test:watch
```

## í´ Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run tests and ensure they pass
6. Submit a pull request

## í³„ License

MIT License - see LICENSE file for details.

## í´— Links

- [Framework Documentation](packages/framework/README.md)
- [Website Demo](packages/website/README.md)
- [Examples](packages/framework/examples/)

---

Built with â¤ï¸ and TypeScript

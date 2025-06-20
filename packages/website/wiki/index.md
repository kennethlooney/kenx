# Kenx Framework Documentation

Welcome to the Kenx Framework documentation! Kenx is a modern, full-stack Node.js web framework built with TypeScript that provides everything you need to build complete web applications.

## What Makes Kenx Unique

Kenx is designed as a **complete full-stack solution** that includes:

- ✅ **Built-in Database ORM** - No need for external ORMs
- ✅ **Custom Template Engine** - Powerful templating with layouts  
- ✅ **Real-time WebSocket Support** - Built-in WebSocket server
- ✅ **Request Lifecycle Hooks** - Before/after request hooks
- ✅ **Enhanced Response Helpers** - Rich response methods
- ✅ **Plugin Architecture** - Extensible plugin system

## Quick Navigation

### Getting Started
- [Installation](/wiki/getting-started/installation)
- [Your First App](/wiki/getting-started/first-app)
- [Project Structure](/wiki/getting-started/project-structure)

### Core Concepts
- [Routing](/wiki/api/routing)
- [Middleware](/wiki/api/middleware)
- [Database ORM](/wiki/api/database)
- [Template Engine](/wiki/api/templates)
- [WebSocket](/wiki/api/websocket)
- [Plugins](/wiki/api/plugins)

### Examples
- [Basic REST API](/wiki/examples/rest-api)
- [Full-Stack Web App](/wiki/examples/fullstack-app)
- [Real-time Chat](/wiki/examples/chat-app)

## Framework Architecture

Kenx follows a middleware-based architecture similar to Express.js but with additional full-stack features built-in:

```
Request → Middleware Stack → Route Handler → Response
                ↓
            Database ORM
            Template Engine  
            WebSocket Server
            Plugin System
```

## Community

- **GitHub**: [kenx-framework](https://github.com/yourusername/kenx)
- **Issues**: Report bugs and request features
- **Discussions**: Ask questions and share ideas

---

> **Note**: This documentation is actively maintained and updated as the framework evolves. If you find any issues or have suggestions, please contribute!

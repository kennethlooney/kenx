# Kenx Framework

A modern, lightweight Node.js web framework built with TypeScript, inspired by Express and Hapi.

## Features

- 🚀 **TypeScript-first** - Built with type safety in mind
- 🗄️ **Built-in ORM** - JSON-based database with models and relationships
- 🎨 **Custom Template Engine** - Kenx template syntax with layouts
- ⚡ **Real-time WebSocket** - Built-in WebSocket support for real-time features
- 🔧 **Middleware System** - Express-like middleware pipeline
- 🔌 **Plugin Architecture** - Extensible with custom plugins
- 📁 **Static File Serving** - Built-in static file handling
- 🛡️ **Security** - Built-in validation, sanitization, and CORS

## Installation

```bash
npm install @kenx/framework
```

## Quick Start

```typescript
import kenx from '@kenx/framework';

const app = kenx();

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Kenx!' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Documentation

For full documentation and examples, see the [main repository](../../README.md).

## License

MIT

# Kenx Website

Example website built with the Kenx framework, demonstrating its full-stack capabilities.

## Features Demonstrated

- ✅ Frontend routing with template rendering
- ✅ REST API endpoints with database integration
- ✅ Real-time WebSocket chat
- ✅ Static file serving
- ✅ Database models and relationships
- ✅ Plugin system integration
- 📚 **Wiki Documentation System** - Markdown-based documentation with navigation
- 🔍 **Breadcrumb Navigation** - Automatic breadcrumb generation
- 📝 **Live Documentation** - Documentation that evolves with the framework

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Available Routes

### Frontend
- `GET /` - Homepage with posts
- `GET /about` - About page
- `GET /chat` - Real-time chat page
- `GET /wiki` - Documentation homepage
- `GET /wiki/*` - Wiki pages (supports nested paths)

### API
- `GET /api/v1/health` - Health check
- `GET /api/v1/posts` - List posts (paginated)
- `POST /api/v1/posts` - Create post

### Static Files
- `GET /static/*` - Static file serving

### WebSocket
- `WS /realtime` - Real-time WebSocket connection

## Wiki Documentation System

The website includes a comprehensive wiki system that demonstrates:

- **Markdown Processing** - Automatic conversion of `.md` files to HTML
- **Dynamic Routing** - Flexible URL structure for nested documentation
- **Navigation Sidebar** - Organized documentation sections
- **Breadcrumb Navigation** - Automatic breadcrumb generation
- **Responsive Design** - Mobile-friendly documentation layout

### Wiki Structure

```
wiki/
├── index.md                    # Documentation homepage
├── getting-started/
│   ├── installation.md         # Installation guide
│   └── first-app.md           # First app tutorial
├── api/
│   ├── routing.md             # Routing documentation
│   └── database.md            # Database ORM guide
└── examples/
    └── fullstack-app.md       # Complete app example
```

### Adding New Documentation

1. Create a new `.md` file in the appropriate `wiki/` subdirectory
2. Write content using standard Markdown syntax
3. The page will automatically be available at `/wiki/path/to/file`
4. Update the navigation in `views/wiki.kenx` if needed

## Architecture

This website showcases how to build a complete full-stack application using the Kenx framework, including:

- Database models for Users and Posts
- Template-based frontend with layouts
- RESTful API design
- Real-time features with WebSocket
- Static asset management

## License

MIT

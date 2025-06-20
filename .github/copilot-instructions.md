<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Kenx Framework Development Guidelines

## Project Overview
This is the kenx framework - a modern, lightweight Node.js web framework built with TypeScript, inspired by Express and Hapi. The framework focuses on simplicity, performance, and developer experience.

## Architecture Principles
- **TypeScript-first**: All code should be written in TypeScript with proper type definitions
- **Middleware-based**: Follow middleware pattern for request/response processing
- **Plugin system**: Support extensible plugin architecture
- **Modern patterns**: Use async/await, ES modules, and modern JavaScript features
- **Lightweight**: Keep dependencies minimal and focused

## Code Style Guidelines
- Use consistent naming conventions (camelCase for variables/functions, PascalCase for classes)
- Prefer composition over inheritance
- Write self-documenting code with clear variable and function names
- Add JSDoc comments for public APIs
- Use strict TypeScript configuration

## Framework Components
- **Core (`src/index.ts`)**: Main framework class with routing and middleware support
- **Middleware (`src/middleware.ts`)**: Built-in middleware functions
- **Router (`src/router.ts`)**: Advanced routing capabilities
- **Plugins (`src/plugins.ts`)**: Plugin system and example plugins

## Development Patterns
- Always provide proper TypeScript types for request/response objects
- Use proper error handling with try/catch blocks
- Support both sync and async middleware/handlers
- Follow RESTful conventions for routing
- Maintain backward compatibility when possible

## Testing Approach
- Write unit tests for core functionality
- Test middleware independently
- Verify plugin system works correctly
- Test routing edge cases

## Performance Considerations
- Minimize memory allocations in hot paths
- Use efficient routing algorithms
- Support connection pooling for plugins
- Optimize middleware execution order

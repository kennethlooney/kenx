import { IncomingMessage, ServerResponse, createServer, Server } from 'http';
import { parse as parseUrl } from 'url';
import { EventEmitter } from 'events';
import KenxDB, { DatabaseConfig } from './database';
import KenxViews, { ViewConfig } from './views';
import KenxWebSocket from './websocket';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface KenxRequest extends IncomingMessage {
  params?: { [key: string]: string };
  query?: { [key: string]: string | string[] };
  body?: any;
  user?: any; // Authenticated user object
  session?: { [key: string]: any }; // Session data
  context: {
    requestId: string;
    startTime: number;
    metadata: { [key: string]: any };
  };
  validate: (schema: any) => boolean;
  sanitize: (data: any) => any;
  isAuthenticated: () => boolean;
  login: (user: any) => void;
  logout: () => void;
}

export interface KenxResponse extends ServerResponse {
  json: (data: any) => void;
  status: (code: number) => KenxResponse;
  send: (data: string | Buffer) => void;
  render: (template: string, data?: any, options?: any) => Promise<void>;
  success: (data: any, message?: string) => void;
  error: (message: string, code?: number, details?: any) => void;
  paginate: (data: any[], page: number, limit: number, total: number) => void;
}

export type Middleware = (req: KenxRequest, res: KenxResponse, next: NextFunction) => void;
export type NextFunction = (error?: Error) => void;
export type RouteHandler = (req: KenxRequest, res: KenxResponse) => void | Promise<void>;
export type HookHandler = (...args: any[]) => void | Promise<void>;

interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
  middlewares: Middleware[];
}

export interface KenxConfig {
  port?: number;
  database?: DatabaseConfig;
  views?: ViewConfig;
  static?: {
    directory: string;
    prefix?: string;
  };
  websocket?: {
    enabled: boolean;
    path?: string;
  };
  auth?: {
    enabled: boolean;
    sessionSecret?: string;
    sessionExpiry?: number; // in milliseconds
    loginRoute?: string;
    logoutRoute?: string;
    protectedRoutes?: string[];
    jwtSecret?: string; // JWT secret key
  };
}

export class Kenx extends EventEmitter {
  private routes: Route[] = [];
  private globalMiddlewares: Middleware[] = [];
  private server?: Server;
  private hooks: Map<string, HookHandler[]> = new Map();
  private sessions: Map<string, any> = new Map(); // Session storage
    // Full-stack components
  public db?: KenxDB;
  public views?: KenxViews;
  public ws?: KenxWebSocket;
  
  public config: KenxConfig;

  constructor(config: KenxConfig = {}) {
    super();
    this.config = config;
    
    // Initialize database if configured
    if (config.database) {
      this.db = new KenxDB(config.database);
    }
    
    // Initialize view engine if configured
    if (config.views) {
      this.views = new KenxViews(config.views);
    }
  }

  // Hook system for lifecycle events
  hook(event: string, handler: HookHandler): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(handler);
  }

  private async executeHooks(event: string, ...args: any[]): Promise<void> {
    const handlers = this.hooks.get(event) || [];
    for (const handler of handlers) {
      try {
        await handler(...args);
      } catch (error) {
        this.emit('error', error);
      }
    }
  }

  // Database methods
  model(name: string, schema: any) {
    if (!this.db) {
      throw new Error('Database not configured. Please provide database config when creating Kenx app.');
    }
    return this.db.define(name, schema);
  }

  // Middleware registration
  use(middleware: Middleware): void {
    this.globalMiddlewares.push(middleware);
  }

  // HTTP method handlers
  get(path: string, ...args: (Middleware | RouteHandler)[]): void {
    this.addRoute('GET', path, args);
  }

  post(path: string, ...args: (Middleware | RouteHandler)[]): void {
    this.addRoute('POST', path, args);
  }

  put(path: string, ...args: (Middleware | RouteHandler)[]): void {
    this.addRoute('PUT', path, args);
  }

  delete(path: string, ...args: (Middleware | RouteHandler)[]): void {
    this.addRoute('DELETE', path, args);
  }

  patch(path: string, ...args: (Middleware | RouteHandler)[]): void {
    this.addRoute('PATCH', path, args);
  }

  private addRoute(method: string, path: string, args: (Middleware | RouteHandler)[]): void {
    const handler = args.pop() as RouteHandler;
    const middlewares = args as Middleware[];
    
    this.routes.push({
      method,
      path,
      handler,
      middlewares
    });
  }

  // Route matching
  private matchRoute(method: string, url: string): { route: Route; params: { [key: string]: string } } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      
      const params = this.extractParams(route.path, url);
      if (params !== null) {
        return { route, params };
      }
    }
    return null;
  }

  private extractParams(routePath: string, requestPath: string): { [key: string]: string } | null {
    const routeParts = routePath.split('/');
    const requestParts = requestPath.split('/');

    if (routeParts.length !== requestParts.length) {
      return null;
    }

    const params: { [key: string]: string } = {};

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const requestPart = requestParts[i];

      if (routePart.startsWith(':')) {
        const paramName = routePart.slice(1);
        params[paramName] = requestPart;
      } else if (routePart !== requestPart) {
        return null;
      }
    }

    return params;
  }

  // Request handler
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const request = this.enhanceRequest(req);
    const response = this.enhanceResponse(res);

    // Execute before:request hooks
    await this.executeHooks('before:request', request);

    try {
      const parsedUrl = parseUrl(req.url!, true);
      const pathname = parsedUrl.pathname!;
      const method = req.method!;

      request.query = parsedUrl.query as { [key: string]: string | string[] };

      // Check for static file serving
      if (this.config.static && pathname.startsWith(this.config.static.prefix || '/static')) {
        await this.serveStaticFile(request, response, pathname);
        return;
      }

      // Find matching route
      const matchResult = this.matchRoute(method, pathname);
      
      if (!matchResult) {
        response.status(404);
        if (this.views) {
          try {
            await response.render('404', { url: pathname });
          } catch {
            response.send('Not Found');
          }
        } else {
          response.send('Not Found');
        }
        return;
      }

      const { route, params } = matchResult;
      request.params = params;

      // Execute middlewares
      const allMiddlewares = [...this.globalMiddlewares, ...route.middlewares];
      await this.executeMiddlewares(allMiddlewares, request, response, route.handler);
    } catch (error) {
      await this.executeHooks('error', error, request);
      this.emit('error', error);
      if (!response.headersSent) {
        response.error('Internal Server Error', 500);
      }
    } finally {
      // Execute after:response hooks
      await this.executeHooks('after:response', request, response);
    }
  }

  private async executeMiddlewares(
    middlewares: Middleware[],
    req: KenxRequest,
    res: KenxResponse,
    handler: RouteHandler
  ): Promise<void> {
    let index = 0;

    const next: NextFunction = async (error?: Error) => {
      if (error) {
        throw error;
      }

      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        await middleware(req, res, next);
      } else {
        await handler(req, res);
      }
    };

    await next();
  }
  private enhanceRequest(req: IncomingMessage): KenxRequest {
    const request = req as KenxRequest;
    
    // Add context
    request.context = {
      requestId: uuidv4(),
      startTime: Date.now(),
      metadata: {}
    };

    // Initialize session if auth is enabled
    if (this.config.auth?.enabled) {
      const sessionId = this.extractSessionId(req);
      if (sessionId && this.sessions.has(sessionId)) {
        request.session = this.sessions.get(sessionId);
        request.user = request.session?.user;
      } else {
        request.session = {};
      }
    }

    // Add authentication methods
    request.isAuthenticated = () => {
      return !!(request.user && request.session);
    };

    request.login = (user: any) => {
      if (!this.config.auth?.enabled) {
        throw new Error('Authentication not enabled. Please configure auth in KenxConfig.');
      }
      
      const sessionId = uuidv4();
      const sessionData = {
        user,
        createdAt: Date.now(),
        expiresAt: Date.now() + (this.config.auth.sessionExpiry || 24 * 60 * 60 * 1000) // 24 hours default
      };
      
      this.sessions.set(sessionId, sessionData);
      request.session = sessionData;
      request.user = user;
      
      // Set session cookie (you'd want to make this more secure in production)
      const response = (request as any).res;
      if (response) {
        response.setHeader('Set-Cookie', `kenx-session=${sessionId}; HttpOnly; Path=/; SameSite=Strict`);
      }
    };

    request.logout = () => {
      if (request.session) {
        const sessionId = this.extractSessionId(req);
        if (sessionId) {
          this.sessions.delete(sessionId);
        }
        request.session = {};
        request.user = undefined;
        
        // Clear session cookie
        const response = (request as any).res;
        if (response) {
          response.setHeader('Set-Cookie', 'kenx-session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');
        }
      }
    };

    // Add validation method
    request.validate = (schema: any) => {
      try {
        // Simple validation logic
        for (const [field, rules] of Object.entries(schema)) {
          const value = request.body?.[field] || request.params?.[field] || request.query?.[field];
          const fieldRules = rules as any;
          
          if (fieldRules.required && !value) {
            return false;
          }
          
          if (fieldRules.type && value && typeof value !== fieldRules.type) {
            return false;
          }
        }
        return true;
      } catch {
        return false;
      }
    };

    // Add sanitization method
    request.sanitize = (data: any) => {
      if (typeof data !== 'object' || data === null) {
        return data;
      }
      
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          // Basic HTML escape
          sanitized[key] = value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    return request;
  }

  private extractSessionId(req: IncomingMessage): string | null {
    const cookies = req.headers.cookie;
    if (!cookies) return null;
    
    const sessionCookie = cookies.split(';').find(c => c.trim().startsWith('kenx-session='));
    if (!sessionCookie) return null;
    
    return sessionCookie.split('=')[1];
  }

  private enhanceResponse(res: ServerResponse): KenxResponse {
    const response = res as KenxResponse;

    response.json = (data: any) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(data));
    };

    response.status = (code: number) => {
      response.statusCode = code;
      return response;
    };

    response.send = (data: string | Buffer) => {
      if (typeof data === 'string') {
        response.setHeader('Content-Type', 'text/html');
      }
      response.end(data);
    };

    response.render = async (template: string, data?: any, options?: any) => {
      if (!this.views) {
        throw new Error('View engine not configured');
      }
      
      const html = await this.views.render(template, data, options);
      response.setHeader('Content-Type', 'text/html');
      response.end(html);
    };

    response.success = (data: any, message?: string) => {
      response.json({
        success: true,
        message: message || 'Success',
        data,
        timestamp: new Date().toISOString()
      });
    };

    response.error = (message: string, code = 400, details?: any) => {
      response.status(code).json({
        success: false,
        message,
        details,
        timestamp: new Date().toISOString()
      });
    };

    response.paginate = (data: any[], page: number, limit: number, total: number) => {
      const totalPages = Math.ceil(total / limit);
      response.json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        timestamp: new Date().toISOString()
      });
    };

    return response;
  }

  private async serveStaticFile(req: KenxRequest, res: KenxResponse, pathname: string): Promise<void> {
    // Simple static file serving - in production, use a proper static file server
    const staticDir = this.config.static!.directory;
    const prefix = this.config.static!.prefix || '/static';
    const filePath = path.join(staticDir, pathname.replace(prefix, ''));
    
    try {
      const fs = await import('fs');
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          const content = fs.readFileSync(filePath);
          const ext = path.extname(filePath);
          const mimeTypes: { [key: string]: string } = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
          };
          
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          res.end(content);
          return;
        }
      }
    } catch (error) {
      console.error('Static file serve error:', error);
    }
    
    res.status(404).send('File not found');
  }
  // Server lifecycle
  listen(port: number, callback?: () => void): Server {
    this.server = createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Initialize WebSocket if enabled
    if (this.config.websocket?.enabled && !this.ws) {
      this.ws = new KenxWebSocket(this.server, {
        path: this.config.websocket.path
      });
    }

    this.server.listen(port, callback);
    return this.server;
  }

  start(callback?: () => void): Server {
    const port = this.config.port || 3000;
    return this.listen(port, callback);
  }

  close(callback?: (err?: Error) => void): void {
    if (this.ws) {
      this.ws.close();
    }
    if (this.server) {
      this.server.close(callback);
    }
  }
}

// Factory function
export function kenx(config?: KenxConfig): Kenx {
  return new Kenx(config);
}

// Export auth components
export { auth, jwtAuth, requireRole, PasswordUtils, UserManager, sessionManager, csrfProtection, authRateLimit, JWT } from './auth';

// Export middleware
export * from './middleware';

export default kenx;

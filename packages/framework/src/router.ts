import { Kenx, Middleware, RouteHandler, KenxRequest, KenxResponse } from './index';

export class Router {
  private routes: Array<{
    method: string;
    path: string;
    handler: RouteHandler;
    middlewares: Middleware[];
  }> = [];
  
  private prefix: string = '';
  private middlewares: Middleware[] = [];

  constructor(options: { prefix?: string } = {}) {
    this.prefix = options.prefix || '';
  }

  // Middleware for this router
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
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

  // Route groups
  group(prefix: string, callback: (router: Router) => void): void {
    const groupRouter = new Router({ prefix: this.prefix + prefix });
    callback(groupRouter);
    this.mergeRouter(groupRouter);
  }

  private addRoute(method: string, path: string, args: (Middleware | RouteHandler)[]): void {
    const handler = args.pop() as RouteHandler;
    const routeMiddlewares = args as Middleware[];
    
    this.routes.push({
      method,
      path: this.prefix + path,
      handler,
      middlewares: [...this.middlewares, ...routeMiddlewares]
    });
  }

  private mergeRouter(router: Router): void {
    this.routes.push(...router.routes);
  }

  // Apply router to Kenx app
  applyTo(app: Kenx): void {
    for (const route of this.routes) {
      const { method, path, handler, middlewares } = route;
      
      switch (method) {
        case 'GET':
          app.get(path, ...middlewares, handler);
          break;
        case 'POST':
          app.post(path, ...middlewares, handler);
          break;
        case 'PUT':
          app.put(path, ...middlewares, handler);
          break;
        case 'DELETE':
          app.delete(path, ...middlewares, handler);
          break;
        case 'PATCH':
          app.patch(path, ...middlewares, handler);
          break;
      }
    }
  }

  // Resource routing (RESTful routes)
  resource(name: string, controller: {
    index?: RouteHandler;
    show?: RouteHandler;
    create?: RouteHandler;
    update?: RouteHandler;
    destroy?: RouteHandler;
  }): void {
    const basePath = `/${name}`;
    
    if (controller.index) {
      this.get(basePath, controller.index);
    }
    
    if (controller.show) {
      this.get(`${basePath}/:id`, controller.show);
    }
    
    if (controller.create) {
      this.post(basePath, controller.create);
    }
    
    if (controller.update) {
      this.put(`${basePath}/:id`, controller.update);
    }
    
    if (controller.destroy) {
      this.delete(`${basePath}/:id`, controller.destroy);
    }
  }
}

// Extend Kenx with router functionality
declare module './index' {
  interface Kenx {
    Router: typeof Router;
  }
}

// Add Router to Kenx
Object.defineProperty(Kenx.prototype, 'Router', {
  value: Router,
  writable: false,
  enumerable: false,
  configurable: false
});

export default Router;

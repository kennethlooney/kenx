import { Kenx } from './index';

export interface Plugin {
  name: string;
  version?: string;
  install: (app: Kenx, options?: any) => void | Promise<void>;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private app: Kenx;

  constructor(app: Kenx) {
    this.app = app;
  }

  async register(plugin: Plugin, options?: any): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }

    try {
      await plugin.install(this.app, options);
      this.plugins.set(plugin.name, plugin);
      console.log(`Plugin ${plugin.name} registered successfully`);
    } catch (error) {
      throw new Error(`Failed to register plugin ${plugin.name}: ${error}`);
    }
  }

  unregister(pluginName: string): boolean {
    return this.plugins.delete(pluginName);
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  isRegistered(name: string): boolean {
    return this.plugins.has(name);
  }
}

// Extend Kenx class with plugin functionality
declare module './index' {
  interface Kenx {
    pluginManager: PluginManager;
    register: (plugin: Plugin, options?: any) => Promise<void>;
  }
}

// Add plugin functionality to Kenx prototype
Object.defineProperty(Kenx.prototype, 'pluginManager', {
  get: function() {
    if (!this._pluginManager) {
      this._pluginManager = new PluginManager(this);
    }
    return this._pluginManager;
  }
});

Kenx.prototype.register = function(plugin: Plugin, options?: any): Promise<void> {
  return this.pluginManager.register(plugin, options);
};

// Example plugins
export const authPlugin: Plugin = {
  name: 'auth',
  version: '1.0.0',
  install: (app: Kenx, options: { secret?: string } = {}) => {
    const secret = options.secret || 'default-secret';
    
    // Add auth middleware
    app.use((req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (token) {
        // Simple token validation (in real app, use proper JWT validation)
        if (token === secret) {
          (req as any).authenticated = true;
        }
      }
      
      next();
    });

    // Add auth helper methods
    (app as any).requireAuth = () => {
      return (req: any, res: any, next: any) => {
        if (!req.authenticated) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }
        next();
      };
    };
  }
};

export const validationPlugin: Plugin = {
  name: 'validation',
  version: '1.0.0',
  install: (app: Kenx) => {
    // Add validation helper methods
    (app as any).validate = (schema: any) => {
      return (req: any, res: any, next: any) => {
        const errors: string[] = [];
        
        // Simple validation (in real app, use proper validation library)
        for (const [field, rules] of Object.entries(schema)) {
          const value = req.body?.[field];
          const fieldRules = rules as any;
          
          if (fieldRules.required && !value) {
            errors.push(`${field} is required`);
          }
          
          if (fieldRules.type && value && typeof value !== fieldRules.type) {
            errors.push(`${field} must be of type ${fieldRules.type}`);
          }
          
          if (fieldRules.minLength && value && value.length < fieldRules.minLength) {
            errors.push(`${field} must be at least ${fieldRules.minLength} characters`);
          }
        }
        
        if (errors.length > 0) {
          res.status(400).json({ errors });
          return;
        }
        
        next();
      };
    };
  }
};

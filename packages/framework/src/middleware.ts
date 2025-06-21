import { KenxRequest, KenxResponse, NextFunction } from './index';

// Re-export auth middleware
export { auth, jwtAuth, requireRole, PasswordUtils, UserManager, sessionManager, csrfProtection, authRateLimit, JWT } from './auth';

// JSON body parser middleware
export function json(): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    if (req.headers['content-type']?.includes('application/json')) {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          req.body = JSON.parse(body);
          next();
        } catch (error) {
          const err = new Error('Invalid JSON');
          next(err);
        }
      });
    } else {
      next();
    }
  };
}

// URL-encoded body parser middleware
export function urlencoded(): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        const params = new URLSearchParams(body);
        req.body = Object.fromEntries(params);
        next();
      });
    } else {
      next();
    }
  };
}

// CORS middleware
export function cors(options: {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
} = {}): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    const origin = req.headers.origin as string;
    
    // Set Access-Control-Allow-Origin
    if (options.origin) {
      if (typeof options.origin === 'string') {
        res.setHeader('Access-Control-Allow-Origin', options.origin);
      } else if (Array.isArray(options.origin)) {
        if (origin && options.origin.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      } else if (typeof options.origin === 'function') {
        if (origin && options.origin(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      }
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    // Set other CORS headers
    if (options.methods) {
      res.setHeader('Access-Control-Allow-Methods', options.methods.join(', '));
    } else {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    }

    if (options.allowedHeaders) {
      res.setHeader('Access-Control-Allow-Headers', options.allowedHeaders.join(', '));
    } else {
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    if (options.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).send('');
      return;
    }

    next();
  };
}

// Logger middleware
export function logger(format: 'combined' | 'common' | 'short' = 'combined'): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const timestamp = new Date().toISOString();
      const userAgent = req.headers['user-agent'] as string || 'Unknown';
      
      switch (format) {
        case 'combined':
          console.log(`${timestamp} - ${req.method} ${req.url} ${res.statusCode} - ${duration}ms - ${userAgent}`);
          break;
        case 'common':
          console.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
          break;
        case 'short':
          console.log(`${req.method} ${req.url} ${res.statusCode}`);
          break;
      }
    });

    next();
  };
}

// Static file middleware
export function staticFiles(directory: string): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  const fs = require('fs');
  const path = require('path');
  const mime = require('mime-types');

  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    const filePath = path.join(directory, req.url!);
    
    fs.stat(filePath, (err: any, stats: any) => {
      if (err || !stats.isFile()) {
        next();
        return;
      }

      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  };
}

// Rate limiting middleware
export function rateLimit(options: {
  windowMs?: number;
  max?: number;
  message?: string;
} = {}): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const max = options.max || 100;
  const message = options.message || 'Too many requests, please try again later.';
  
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    // Get IP from socket or headers
    const socket = (req as any).socket || (req as any).connection;
    const ip = socket?.remoteAddress || req.headers['x-forwarded-for'] as string || 'unknown';
    const now = Date.now();
    
    const clientData = requests.get(ip);
    
    if (!clientData || now > clientData.resetTime) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      next();
    } else if (clientData.count < max) {
      clientData.count++;
      next();
    } else {
      res.error(message, 429);
    }
  };
}

// Security headers middleware
export function securityHeaders(options: {
  contentSecurityPolicy?: string;
  hsts?: boolean;
  noSniff?: boolean;
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string;
  xssProtection?: boolean;
} = {}): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    // Content Security Policy
    if (options.contentSecurityPolicy) {
      res.setHeader('Content-Security-Policy', options.contentSecurityPolicy);
    }
    
    // HTTP Strict Transport Security
    if (options.hsts !== false) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    // X-Content-Type-Options
    if (options.noSniff !== false) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    
    // X-Frame-Options
    const frameOptions = options.frameOptions || 'DENY';
    res.setHeader('X-Frame-Options', frameOptions);
    
    // X-XSS-Protection
    if (options.xssProtection !== false) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }
    
    // Remove potentially revealing headers
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Powered-By', 'Kenx');
    
    next();
  };
}

// Compression middleware (simple gzip)
export function compress(): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    const acceptEncoding = req.headers['accept-encoding'] as string || '';
    
    if (acceptEncoding.includes('gzip')) {
      const zlib = require('zlib');
      const originalSend = res.send;
      const originalJson = res.json;
      
      res.send = function(data: any) {
        if (typeof data === 'string' && data.length > 1024) {
          this.setHeader('Content-Encoding', 'gzip');
          const compressed = zlib.gzipSync(data);
          return originalSend.call(this, compressed);
        }
        return originalSend.call(this, data);
      };
      
      res.json = function(data: any) {
        const jsonString = JSON.stringify(data);
        if (jsonString.length > 1024) {
          this.setHeader('Content-Encoding', 'gzip');
          this.setHeader('Content-Type', 'application/json');
          const compressed = zlib.gzipSync(jsonString);
          return this.end(compressed);
        }
        return originalJson.call(this, data);
      };
    }
    
    next();
  };
}

// Request timeout middleware
export function timeout(ms: number = 30000): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.error('Request timeout', 408);
      }
    }, ms);
    
    res.on('finish', () => {
      clearTimeout(timer);
    });
    
    res.on('close', () => {
      clearTimeout(timer);
    });
    
    next();
  };
}

// Request ID middleware for tracing
export function requestId(): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    const crypto = require('crypto');
    const id = req.headers['x-request-id'] as string || crypto.randomUUID();
    
    req.context.requestId = id;
    res.setHeader('X-Request-ID', id);
    
    next();
  };
}

// Health check middleware
export function healthCheck(path: string = '/health'): (req: KenxRequest, res: KenxResponse, next: NextFunction) => void {
  return (req: KenxRequest, res: KenxResponse, next: NextFunction) => {
    if (req.url === path && req.method === 'GET') {
      return res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      });
    }
    
    next();
  };
}

import { KenxRequest, KenxResponse, NextFunction } from './index';

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

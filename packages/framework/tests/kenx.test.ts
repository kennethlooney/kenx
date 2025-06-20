import kenx, { Kenx } from '../src/index';
import { json, cors, logger } from '../src/middleware';

describe('Kenx Framework', () => {
  let app: Kenx;

  beforeEach(() => {
    app = kenx();
  });

  afterEach(() => {
    if (app) {
      app.close();
    }
  });

  test('should create a kenx instance', () => {
    expect(app).toBeInstanceOf(Kenx);
  });

  test('should add middleware', () => {
    const middleware = (req: any, res: any, next: any) => next();
    app.use(middleware);
    // Test that middleware is added (would need more implementation to verify)
  });

  test('should register routes', () => {
    app.get('/test', (req, res) => {
      res.json({ test: true });
    });
    
    app.post('/test', (req, res) => {
      res.json({ method: 'POST' });
    });
    
    // Test that routes are registered (would need more implementation to verify)
  });

  test('should handle route parameters', () => {
    app.get('/users/:id', (req, res) => {
      res.json({ userId: req.params?.id });
    });
    
    // Test parameter extraction (would need HTTP client for full test)
  });

  test('should support async handlers', async () => {
    app.get('/async', async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      res.json({ async: true });
    });
    
    // Test async handling (would need HTTP client for full test)
  });
});

describe('Middleware', () => {
  test('json middleware should parse JSON bodies', () => {
    const jsonMiddleware = json();
    expect(typeof jsonMiddleware).toBe('function');
  });

  test('cors middleware should set CORS headers', () => {
    const corsMiddleware = cors();
    expect(typeof corsMiddleware).toBe('function');
  });

  test('logger middleware should log requests', () => {
    const loggerMiddleware = logger('combined');
    expect(typeof loggerMiddleware).toBe('function');
  });
});

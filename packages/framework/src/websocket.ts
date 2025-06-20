import { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

export interface WSClient {
  id: string;
  ws: WebSocket;
  rooms: Set<string>;
  data: { [key: string]: any };
  authenticated?: boolean;
  userId?: string;
}

export interface WSMessage {
  event: string;
  data?: any;
  room?: string;
  to?: string;
}

export class KenxWebSocket extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, WSClient> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private messageHandlers: Map<string, Function[]> = new Map();

  constructor(server: HttpServer, options: { path?: string } = {}) {
    super();
    
    this.wss = new WebSocketServer({ 
      server,
      path: options.path || '/ws'
    });

    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const clientId = this.generateClientId();
      const client: WSClient = {
        id: clientId,
        ws,
        rooms: new Set(),
        data: {}
      };

      this.clients.set(clientId, client);
      
      // Setup client message handling
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WSMessage;
          this.handleMessage(client, message);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.handleDisconnect(client);
      });

      // Handle connection errors
      ws.on('error', (error: Error) => {
        console.error('WebSocket client error:', error);
        this.handleDisconnect(client);
      });

      // Emit connection event
      this.emit('connection', client);
      
      // Send welcome message
      this.send(client, 'connected', { clientId, timestamp: new Date().toISOString() });
    });
  }

  // Message handling
  private handleMessage(client: WSClient, message: WSMessage): void {
    // Emit to specific event handlers
    const handlers = this.messageHandlers.get(message.event) || [];
    handlers.forEach(handler => {
      try {
        handler(client, message.data, message);
      } catch (error) {
        console.error(`WebSocket handler error for event ${message.event}:`, error);
      }
    });

    // Emit general message event
    this.emit('message', client, message);
  }

  private handleDisconnect(client: WSClient): void {
    // Remove from all rooms
    client.rooms.forEach(room => {
      this.leaveRoom(client.id, room);
    });

    // Remove client
    this.clients.delete(client.id);

    // Emit disconnect event
    this.emit('disconnect', client);
  }

  // Public API methods
  
  // Register event handlers
  on(event: 'connection', listener: (client: WSClient) => void): this;
  on(event: 'disconnect', listener: (client: WSClient) => void): this;
  on(event: 'message', listener: (client: WSClient, message: WSMessage) => void): this;
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  // Register message handlers for specific events
  handle(event: string, handler: (client: WSClient, data: any, message: WSMessage) => void): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  // Send message to specific client
  send(client: WSClient | string, event: string, data?: any): void {
    const targetClient = typeof client === 'string' ? this.clients.get(client) : client;
    
    if (!targetClient || targetClient.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WSMessage = { event, data };
    targetClient.ws.send(JSON.stringify(message));
  }

  // Broadcast to all clients
  broadcast(event: string, data?: any, except?: string[]): void {
    const message: WSMessage = { event, data };
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN && (!except || !except.includes(clientId))) {
        client.ws.send(messageStr);
      }
    });
  }

  // Room management
  joinRoom(clientId: string, room: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    // Add client to room
    client.rooms.add(room);
    
    // Add room to rooms map
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(clientId);

    // Emit room join event
    this.emit('join', client, room);
    
    return true;
  }

  leaveRoom(clientId: string, room: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    // Remove client from room
    client.rooms.delete(room);
    
    // Remove from rooms map
    const roomClients = this.rooms.get(room);
    if (roomClients) {
      roomClients.delete(clientId);
      if (roomClients.size === 0) {
        this.rooms.delete(room);
      }
    }

    // Emit room leave event
    this.emit('leave', client, room);
    
    return true;
  }

  // Send message to all clients in a room
  toRoom(room: string, event: string, data?: any): void {
    const roomClients = this.rooms.get(room);
    if (!roomClients) return;

    const message: WSMessage = { event, data, room };
    const messageStr = JSON.stringify(message);

    roomClients.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  // Get client information
  getClient(clientId: string): WSClient | undefined {
    return this.clients.get(clientId);
  }

  getAllClients(): WSClient[] {
    return Array.from(this.clients.values());
  }

  getClientsInRoom(room: string): WSClient[] {
    const roomClients = this.rooms.get(room);
    if (!roomClients) return [];

    return Array.from(roomClients)
      .map(clientId => this.clients.get(clientId))
      .filter(client => client !== undefined) as WSClient[];
  }

  // Authentication helpers
  authenticate(clientId: string, userId: string, userData?: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    client.authenticated = true;
    client.userId = userId;
    if (userData) {
      client.data = { ...client.data, ...userData };
    }

    this.emit('authenticate', client);
    return true;
  }

  requireAuth(handler: (client: WSClient, data: any, message: WSMessage) => void) {
    return (client: WSClient, data: any, message: WSMessage) => {
      if (!client.authenticated) {
        this.send(client, 'error', { message: 'Authentication required' });
        return;
      }
      handler(client, data, message);
    };
  }

  // Utility methods
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Statistics
  getStats() {
    return {
      totalClients: this.clients.size,
      totalRooms: this.rooms.size,
      authenticatedClients: Array.from(this.clients.values()).filter(c => c.authenticated).length,
      rooms: Array.from(this.rooms.entries()).map(([name, clients]) => ({
        name,
        clientCount: clients.size
      }))
    };
  }

  // Cleanup
  close(): void {
    this.clients.forEach(client => {
      client.ws.close();
    });
    this.wss.close();
  }
}

export default KenxWebSocket;

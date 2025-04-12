import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// Default endpoint for MetaTrader 5 HTTP API
const MT5_API_ENDPOINT = process.env.MT5_API_ENDPOINT || 'http://localhost:5555';
const MT5_API_KEY = process.env.MT5_API_KEY || '';

// Flask API endpoint for optimization (assume same host, port 5000)
const MT5_FLASK_API = process.env.MT5_FLASK_API || 'http://localhost:5000';

// Interface for MetaTrader 5 account info
interface Mt5AccountInfo {
  login: number;
  name: string;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: number;
}

// Interface for Symbol info
interface Mt5SymbolInfo {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  time: string;
}

// Interface for Position info
interface Mt5Position {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  openTime: string;
  sl: number;
  tp: number;
  profit: number;
  comment: string;
}

// Interface for Order info
interface Mt5Order {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  openTime: string;
  sl: number;
  tp: number;
  comment: string;
}

// Interface for creating a new order
interface Mt5OrderRequest {
  symbol: string;
  type: string;
  volume: number;
  price?: number;
  sl?: number;
  tp?: number;
  comment?: string;
}

// Type validation functions
const isAccountInfoArg = (args: any): args is { account?: number } => 
  typeof args === 'object' && args !== null && 
  (args.account === undefined || typeof args.account === 'number');

const isSymbolPriceArg = (args: any): args is { symbol: string } => 
  typeof args === 'object' && args !== null && 
  typeof args.symbol === 'string';

const isOrderArg = (args: any): args is Mt5OrderRequest => 
  typeof args === 'object' && args !== null && 
  typeof args.symbol === 'string' && 
  typeof args.type === 'string' && 
  typeof args.volume === 'number';

const isModifyOrderArg = (args: any): args is { ticket: number, sl?: number, tp?: number } => 
  typeof args === 'object' && args !== null && 
  typeof args.ticket === 'number';

const isCloseOrderArg = (args: any): args is { ticket: number } => 
  typeof args === 'object' && args !== null && 
  typeof args.ticket === 'number';

// --- Optimization tool type guards ---
const isRunOptimizationArg = (args: any): args is {
  symbol: string;
  ea: string;
  period: string;
  date_from: string;
  date_to: string;
  deposit: number;
  params: object;
  optimization_mode?: string;
  other_options?: object;
} =>
  typeof args === 'object' && args !== null &&
  typeof args.symbol === 'string' &&
  typeof args.ea === 'string' &&
  typeof args.period === 'string' &&
  typeof args.date_from === 'string' &&
  typeof args.date_to === 'string' &&
  typeof args.deposit === 'number' &&
  typeof args.params === 'object';

const isOptimizationIdArg = (args: any): args is { optimization_id: string } =>
  typeof args === 'object' && args !== null && typeof args.optimization_id === 'string';

const isSaveOptimizationResultsArg = (args: any): args is { optimization_id: string; format?: string; path?: string } =>
  typeof args === 'object' && args !== null && typeof args.optimization_id === 'string';

export class Mt5Server {
  private server: Server;
  private apiClient;
  private flaskClient;

  constructor() {
    this.server = new Server(
      {
        name: 'metatrader5-mcp-server',
        version: '1.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Create Axios client for MT5 API requests
    this.apiClient = axios.create({
      baseURL: MT5_API_ENDPOINT,
      headers: MT5_API_KEY ? { 'Authorization': `Bearer ${MT5_API_KEY}` } : {},
    });

    // Create Axios client for Flask API
    this.flaskClient = axios.create({
      baseURL: MT5_FLASK_API,
    });

    // Setup tool handlers
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // --- Existing tools ---
        {
          name: 'get_account_info',
          description: 'Get account information from MetaTrader 5',
          inputSchema: {
            type: 'object',
            properties: {
              account: {
                type: 'number',
                description: 'Account number (optional, uses default if not provided)',
              },
            },
            required: [],
          },
        },
        {
          name: 'get_symbol_price',
          description: 'Get current price for a symbol',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                description: 'Symbol name (e.g., "EURUSD", "BTCUSD")',
              },
            },
            required: ['symbol'],
          },
        },
        {
          name: 'get_open_positions',
          description: 'Get all open positions',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'get_pending_orders',
          description: 'Get all pending orders',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'create_order',
          description: 'Create a new trading order',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                description: 'Symbol name (e.g., "EURUSD")',
              },
              type: {
                type: 'string',
                description: 'Order type: "BUY", "SELL", "BUYLIMIT", "SELLLIMIT", "BUYSTOP", "SELLSTOP"',
              },
              volume: {
                type: 'number',
                description: 'Order volume in lots',
              },
              price: {
                type: 'number',
                description: 'Order price (required for limit and stop orders)',
              },
              sl: {
                type: 'number',
                description: 'Stop loss price (optional)',
              },
              tp: {
                type: 'number',
                description: 'Take profit price (optional)',
              },
              comment: {
                type: 'string',
                description: 'Order comment (optional)',
              },
            },
            required: ['symbol', 'type', 'volume'],
          },
        },
        {
          name: 'modify_order',
          description: 'Modify stop loss or take profit for an order or position',
          inputSchema: {
            type: 'object',
            properties: {
              ticket: {
                type: 'number',
                description: 'Order or position ticket number',
              },
              sl: {
                type: 'number',
                description: 'New stop loss price',
              },
              tp: {
                type: 'number',
                description: 'New take profit price',
              },
            },
            required: ['ticket'],
          },
        },
        {
          name: 'close_position',
          description: 'Close an open position',
          inputSchema: {
            type: 'object',
            properties: {
              ticket: {
                type: 'number',
                description: 'Position ticket number',
              },
            },
            required: ['ticket'],
          },
        },
        {
          name: 'delete_order',
          description: 'Delete a pending order',
          inputSchema: {
            type: 'object',
            properties: {
              ticket: {
                type: 'number',
                description: 'Order ticket number',
              },
            },
            required: ['ticket'],
          },
        },
        // --- Optimization tools ---
        {
          name: 'run_optimization',
          description: 'Start a strategy optimization run via the MT5 Flask API bridge',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: { type: 'string', description: 'Symbol to optimize (e.g., "EURUSD")' },
              ea: { type: 'string', description: 'Expert Advisor file (e.g., "MyExpert.ex5")' },
              period: { type: 'string', description: 'Timeframe (e.g., "H1")' },
              date_from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
              date_to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
              deposit: { type: 'number', description: 'Initial deposit' },
              params: { type: 'object', description: 'Optimization parameters (ranges/steps)' },
              optimization_mode: { type: 'string', enum: ['genetic', 'all_possible'], description: 'Optimization mode ("genetic" or "all_possible")', default: 'genetic' },
              other_options: { type: 'object', description: 'Additional options (optional)' }
            },
            required: ['symbol', 'ea', 'period', 'date_from', 'date_to', 'deposit', 'params'],
          }
        },
        {
          name: 'get_optimization_status',
          description: 'Query the status of a running optimization',
          inputSchema: {
            type: 'object',
            properties: {
              optimization_id: { type: 'string', description: 'Optimization run ID' }
            },
            required: ['optimization_id']
          }
        },
        {
          name: 'get_optimization_results',
          description: 'Fetch results/statistics of a completed optimization',
          inputSchema: {
            type: 'object',
            properties: {
              optimization_id: { type: 'string', description: 'Optimization run ID' }
            },
            required: ['optimization_id']
          }
        },
        {
          name: 'save_optimization_results',
          description: 'Save optimization results to a file (CSV/JSON)',
          inputSchema: {
            type: 'object',
            properties: {
              optimization_id: { type: 'string', description: 'Optimization run ID' },
              format: { type: 'string', enum: ['csv', 'json'], description: 'File format', default: 'json' },
              path: { type: 'string', description: 'File path to save results (optional)' }
            },
            required: ['optimization_id']
          }
        }
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          // --- Existing tools ---
          case 'get_account_info':
            return await this.handleGetAccountInfo(request.params.arguments);
          case 'get_symbol_price':
            return await this.handleGetSymbolPrice(request.params.arguments);
          case 'get_open_positions':
            return await this.handleGetOpenPositions();
          case 'get_pending_orders':
            return await this.handleGetPendingOrders();
          case 'create_order':
            return await this.handleCreateOrder(request.params.arguments);
          case 'modify_order':
            return await this.handleModifyOrder(request.params.arguments);
          case 'close_position':
            return await this.handleClosePosition(request.params.arguments);
          case 'delete_order':
            return await this.handleDeleteOrder(request.params.arguments);
          // --- Optimization tools ---
          case 'run_optimization':
            return await this.handleRunOptimization(request.params.arguments);
          case 'get_optimization_status':
            return await this.handleGetOptimizationStatus(request.params.arguments);
          case 'get_optimization_results':
            return await this.handleGetOptimizationResults(request.params.arguments);
          case 'save_optimization_results':
            return await this.handleSaveOptimizationResults(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const message = error.response?.data?.message || error.message;
          return {
            content: [
              {
                type: 'text',
                text: `MetaTrader 5 API error: ${message}`,
              },
            ],
            isError: true,
          };
        }
        
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Unexpected error: ${(error as Error).message}`
        );
      }
    });
  }

  // --- Existing handlers omitted for brevity (same as before) ---

  private async handleGetAccountInfo(args: any) {
    if (!isAccountInfoArg(args)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid account info arguments');
    }
    const endpoint = args.account ? `/account/${args.account}` : '/account';
    const response = await this.apiClient.get<Mt5AccountInfo>(endpoint);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async handleGetSymbolPrice(args: any) {
    if (!isSymbolPriceArg(args)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid symbol price arguments');
    }
    const response = await this.apiClient.get<Mt5SymbolInfo>(`/symbol/${args.symbol}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async handleGetOpenPositions() {
    const response = await this.apiClient.get<Mt5Position[]>('/positions');
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async handleGetPendingOrders() {
    const response = await this.apiClient.get<Mt5Order[]>('/orders');
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async handleCreateOrder(args: any) {
    if (!isOrderArg(args)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid order arguments');
    }
    const response = await this.apiClient.post('/order', args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async handleModifyOrder(args: any) {
    if (!isModifyOrderArg(args)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid modify order arguments');
    }
    const response = await this.apiClient.put(`/order/${args.ticket}`, {
      sl: args.sl,
      tp: args.tp,
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async handleClosePosition(args: any) {
    if (!isCloseOrderArg(args)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid close position arguments');
    }
    const response = await this.apiClient.delete(`/position/${args.ticket}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async handleDeleteOrder(args: any) {
    if (!isCloseOrderArg(args)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid delete order arguments');
    }
    const response = await this.apiClient.delete(`/order/${args.ticket}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  // --- Optimization handlers ---
  private async handleRunOptimization(args: any) {
    if (!isRunOptimizationArg(args)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid run_optimization arguments');
    }
    const response = await this.flaskClient.post('/optimize', args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async handleGetOptimizationStatus(args: any) {
    if (!isOptimizationIdArg(args)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid get_optimization_status arguments');
    }
    const response = await this.flaskClient.get(`/optimization_status/${args.optimization_id}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async handleGetOptimizationResults(args: any) {
    if (!isOptimizationIdArg(args)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid get_optimization_results arguments');
    }
    const response = await this.flaskClient.get(`/optimization_results/${args.optimization_id}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async handleSaveOptimizationResults(args: any) {
    if (!isSaveOptimizationResultsArg(args)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid save_optimization_results arguments');
    }
    const response = await this.flaskClient.post('/save_results', args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MetaTrader 5 MCP server running on stdio');
  }
}

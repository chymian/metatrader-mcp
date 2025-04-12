#!/usr/bin/env node
import { createServer } from 'node:http';
import axios from 'axios';

// Default endpoint for MetaTrader 5 HTTP API
const MT5_API_ENDPOINT = process.env.MT5_API_ENDPOINT || 'http://localhost:5555';
const MT5_API_KEY = process.env.MT5_API_KEY || '';

// Create Axios client for MT5 API requests
const apiClient = axios.create({
  baseURL: MT5_API_ENDPOINT,
  headers: MT5_API_KEY ? { 'Authorization': `Bearer ${MT5_API_KEY}` } : {},
});

// Define MCP server capabilities
const serverInfo = {
  name: 'metatrader5-mcp-server',
  version: '1.0.0',
};

// Define available tools
const tools = [
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
];

// Type validation functions
const isAccountInfoArg = (args) => 
  typeof args === 'object' && args !== null && 
  (args.account === undefined || typeof args.account === 'number');

const isSymbolPriceArg = (args) => 
  typeof args === 'object' && args !== null && 
  typeof args.symbol === 'string';

const isOrderArg = (args) => 
  typeof args === 'object' && args !== null && 
  typeof args.symbol === 'string' && 
  typeof args.type === 'string' && 
  typeof args.volume === 'number';

const isModifyOrderArg = (args) => 
  typeof args === 'object' && args !== null && 
  typeof args.ticket === 'number';

const isCloseOrderArg = (args) => 
  typeof args === 'object' && args !== null && 
  typeof args.ticket === 'number';

// Handle MCP requests
async function handleMcpRequest(request) {
  switch (request.method) {
    case 'list_tools':
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: { tools },
      };
      
    case 'call_tool':
      try {
        let result;
        switch (request.params.name) {
          case 'get_account_info':
            result = await handleGetAccountInfo(request.params.arguments);
            break;
          case 'get_symbol_price':
            result = await handleGetSymbolPrice(request.params.arguments);
            break;
          case 'get_open_positions':
            result = await handleGetOpenPositions();
            break;
          case 'get_pending_orders':
            result = await handleGetPendingOrders();
            break;
          case 'create_order':
            result = await handleCreateOrder(request.params.arguments);
            break;
          case 'modify_order':
            result = await handleModifyOrder(request.params.arguments);
            break;
          case 'close_position':
            result = await handleClosePosition(request.params.arguments);
            break;
          case 'delete_order':
            result = await handleDeleteOrder(request.params.arguments);
            break;
          default:
            return {
              jsonrpc: '2.0',
              id: request.id,
              error: {
                code: -32601,
                message: `Unknown tool: ${request.params.name}`,
              },
            };
        }
        
        return {
          jsonrpc: '2.0',
          id: request.id,
          result,
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const message = error.response?.data?.message || error.message;
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `MetaTrader 5 API error: ${message}`,
                },
              ],
              isError: true,
            },
          };
        }
        
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32603,
            message: `Unexpected error: ${error.message}`,
          },
        };
      }
      
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          success: true,
          serverInfo,
          capabilities: {
            tools: {},
          },
        },
      };
      
    default:
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`,
        },
      };
  }
}

// Handler functions
async function handleGetAccountInfo(args) {
  if (!isAccountInfoArg(args)) {
    throw new Error('Invalid account info arguments');
  }

  try {
    const endpoint = args.account ? `/account/${args.account}` : '/account';
    const response = await apiClient.get(endpoint);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  } catch (error) {
    throw error;
  }
}

async function handleGetSymbolPrice(args) {
  if (!isSymbolPriceArg(args)) {
    throw new Error('Invalid symbol price arguments');
  }

  try {
    const response = await apiClient.get(`/symbol/${args.symbol}`);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  } catch (error) {
    throw error;
  }
}

async function handleGetOpenPositions() {
  try {
    const response = await apiClient.get('/positions');
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  } catch (error) {
    throw error;
  }
}

async function handleGetPendingOrders() {
  try {
    const response = await apiClient.get('/orders');
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  } catch (error) {
    throw error;
  }
}

async function handleCreateOrder(args) {
  if (!isOrderArg(args)) {
    throw new Error('Invalid order arguments');
  }

  try {
    const response = await apiClient.post('/order', args);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  } catch (error) {
    throw error;
  }
}

async function handleModifyOrder(args) {
  if (!isModifyOrderArg(args)) {
    throw new Error('Invalid modify order arguments');
  }

  try {
    const response = await apiClient.put(`/order/${args.ticket}`, {
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
  } catch (error) {
    throw error;
  }
}

async function handleClosePosition(args) {
  if (!isCloseOrderArg(args)) {
    throw new Error('Invalid close position arguments');
  }

  try {
    const response = await apiClient.delete(`/position/${args.ticket}`);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  } catch (error) {
    throw error;
  }
}

async function handleDeleteOrder(args) {
  if (!isCloseOrderArg(args)) {
    throw new Error('Invalid delete order arguments');
  }

  try {
    const response = await apiClient.delete(`/order/${args.ticket}`);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  } catch (error) {
    throw error;
  }
}

// Read and process MCP messages from stdin
let buffer = '';
process.stdin.on('data', async (chunk) => {
  buffer += chunk.toString();
  
  // Process complete messages
  while (true) {
    const match = buffer.match(/Content-Length: (\d+)\r\n\r\n/);
    if (!match) break;
    
    const contentLength = parseInt(match[1], 10);
    const headerEndIndex = match.index + match[0].length;
    const contentEndIndex = headerEndIndex + contentLength;
    
    if (buffer.length < contentEndIndex) break;
    
    const content = buffer.substring(headerEndIndex, contentEndIndex);
    buffer = buffer.substring(contentEndIndex);
    
    try {
      const request = JSON.parse(content);
      const response = await handleMcpRequest(request);
      
      const responseContent = JSON.stringify(response);
      const header = `Content-Length: ${responseContent.length}\r\n\r\n`;
      process.stdout.write(header + responseContent);
    } catch (error) {
      console.error('Error processing request:', error);
    }
  }
});

// Setup HTTP server for local debugging (not required for MCP)
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('MetaTrader 5 MCP Server is running.\n');
});

// Signal handling for clean shutdown
process.on('SIGINT', () => {
  console.error('Shutting down server...');
  process.exit(0);
});

// Start the server
console.error('MetaTrader 5 MCP Server running on stdio');

# MetaTrader 5 MCP Server

This is a Model Context Protocol (MCP) server that provides tools for controlling and interacting with MetaTrader 5 through a REST API and supports programmatic strategy optimization.

---

## Features

The MetaTrader 5 MCP Server provides the following tools:

- `get_account_info` - Get account information from MetaTrader 5
- `get_symbol_price` - Get current price for a symbol
- `get_open_positions` - Get all open positions
- `get_pending_orders` - Get all pending orders
- `create_order` - Create a new trading order
- `modify_order` - Modify stop loss or take profit for an order or position
- `close_position` - Close an open position
- `delete_order` - Delete a pending order

### Optimization Tools (NEW)

- `run_optimization` - Start a strategy optimization run via the MT5 Flask API bridge
- `get_optimization_status` - Query the status of a running optimization
- `get_optimization_results` - Fetch results/statistics of a completed optimization
- `save_optimization_results` - Save optimization results to a file (CSV/JSON)

---

## Prerequisites

1. MetaTrader 5 terminal installed and running in Wine inside a Distrobox container (see `src/mt5.ini` for setup).
2. Python with the `MetaTrader5` package installed in the Wine environment.
3. Flask REST API running on the Linux host (see below for API details).

---

## Flask REST API for Optimization

The MCP server expects a Flask API (Python) running on the host (default: `http://localhost:5000`) with the following endpoints:

- `POST /optimize` — Start an optimization run. Accepts EA, symbol, period, date range, deposit, params, optimization_mode.
- `GET /optimization_status/<id>` — Get the status of a running optimization.
- `GET /optimization_results/<id>` — Fetch results/statistics for a completed optimization.
- `POST /save_results` — Save results to a file (CSV/JSON), with path and format options.

See the research paper in `docs/To programmatically run strategy optimiz.md` for a full example and setup instructions.

---

## Usage

### Starting the server

```
npm start
```

### MCP Configuration

Add the following to your MCP settings configuration:

```json
{
  "mcpServers": {
    "metatrader5": {
      "command": "node",
      "args": ["/path/to/metatrader-mcp/build/index.js"],
      "env": {
        "MT5_API_ENDPOINT": "http://localhost:5555",
        "MT5_API_KEY": "",
        "MT5_FLASK_API": "http://localhost:5000"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

---

## Tool Usage Examples

### Run Optimization

```js
use_mcp_tool({
  server_name: "metatrader5",
  tool_name: "run_optimization",
  arguments: {
    symbol: "EURUSD",
    ea: "MyExpert.ex5",
    period: "H1",
    date_from: "2024-01-01",
    date_to: "2024-03-01",
    deposit: 10000,
    params: {
      "TakeProfit": { min: 10, max: 100, step: 10 },
      "StopLoss": { min: 10, max: 100, step: 10 }
    },
    optimization_mode: "all_possible"
  }
})
```

### Poll for Status

```js
use_mcp_tool({
  server_name: "metatrader5",
  tool_name: "get_optimization_status",
  arguments: { optimization_id: "..." }
})
```

### Fetch and Save Results

```js
use_mcp_tool({
  server_name: "metatrader5",
  tool_name: "get_optimization_results",
  arguments: { optimization_id: "..." }
})
use_mcp_tool({
  server_name: "metatrader5",
  tool_name: "save_optimization_results",
  arguments: { optimization_id: "...", format: "csv", path: "/path/to/results.csv" }
})
```

---

## Distrobox/Container Setup

See `src/mt5.ini` for a sample Distrobox container configuration to run MT5 and the Flask API in a reproducible environment.

---

## Implementation Notes

- The MCP server acts as a client to both the MetaTrader 5 REST API and the Flask optimization API.
- All optimization tools are compatible with "genetic" and "all_possible" modes.
- Results can be fetched and saved in JSON or CSV format.

---

## References

- See `docs/To programmatically run strategy optimiz.md` for the research paper and full technical background.

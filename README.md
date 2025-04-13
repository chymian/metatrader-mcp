# MetaTrader 5 MCP Server & Distrobox Automation

This project provides a fully automated workflow for running, optimizing, and documenting MetaTrader 5 (MT5) Expert Advisors (EAs) using a Distrobox container, a Flask REST API, and an MCP server.

---

## Features

- **MetaTrader 5 in Wine/Distrobox**: Automated setup and launch.
- **Flask REST API**: Programmatic optimization of EAs, with endpoints for running, monitoring, and saving results.
- **MCP Server**: Unified interface for trading, optimization, and result retrieval.
- **Automated Documentation**: Optimization results are saved as clear HTML and Markdown reports for each EA.
- **Git Version Control**: All code and configuration are versioned from the start.

---

## Quickstart

### 1. Distrobox Container Setup

To assemble and enter the Distrobox container, run the following commands from the project root:

```bash
distrobox-assemble create --file src/mt5.ini -R
distrobox-enter mt5
```

- See `src/mt5.ini` for a complete, automated Distrobox config.
- On container creation, the following are installed and configured:
  - Wine, MT5, Python3, pip, Flask, MetaTrader5, pandas, jinja2, git, and all required tools.
  - The Flask API is started automatically.
  - A git repository is initialized and all files are committed.

### 2. Flask REST API

- Located at `src/mt5_flask_api.py`.
- The API is accessible from the host at [http://localhost:5000](http://localhost:5000) (port 5000 is published by default; see `src/mt5.ini`).
- Example: test the API from your host system with:
  ```bash
  curl http://localhost:5000/optimization_status/some-id
  ```
- Endpoints:
  - `POST /optimize`: Start an optimization run.
  - `GET /optimization_status/<id>`: Check optimization status.
  - `GET /optimization_results/<id>`: Get results.
  - `POST /save_results`: Save results as HTML/Markdown/CSV/JSON.
- Results are saved to `~/mt5-dev/result/manual/tuning/<EA_NAME>_tuning.html` and `.md`.

### 3. MCP Server

- See `src/mt5-server.ts` for the MCP server implementation.
- Tools include:
  - Trading operations (get_account_info, create_order, etc.)
  - Optimization operations (run_optimization, get_optimization_status, get_optimization_results, save_optimization_results)

### 4. Usage Example

- Start the container (Distrobox will run all setup and start the Flask API).
- Use the MCP server to trigger optimizations and generate reports.
- Open the HTML/Markdown reports in `~/mt5-dev/result/manual/tuning/` for a clear overview.

---

## Working Directory & Configuration

By default, all logs, data, results, and outputs are stored in `~/mt5-dev` for portability and consistency.  
To override any configuration value for your local development, copy `src/mt5.ini` to `src/mt5-dev.ini` and customize as needed.  
The `src/mt5-dev.ini` file is ignored by git and will not be tracked or pushed.

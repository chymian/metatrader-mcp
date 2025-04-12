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

- See `src/mt5.ini` for a complete, automated Distrobox config.
- On container creation, the following are installed and configured:
  - Wine, MT5, Python3, pip, Flask, MetaTrader5, pandas, jinja2, git, and all required tools.
  - The Flask API is started automatically.
  - A git repository is initialized and all files are committed.

### 2. Flask REST API

- Located at `src/mt5_flask_api.py`.
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

## Directory Structure

- `src/mt5.ini`: Distrobox config for full automation.
- `src/mt5_flask_api.py`: Flask API for optimization.
- `src/mt5-server.ts`: MCP server logic.
- `docs/README.md`: This documentation.
- `~/mt5-dev/result/manual/tuning/`: All generated reports and results.

---

## Working Directory & Configuration

By default, all logs, data, results, and outputs are stored in `~/mt5-dev` for portability and consistency.  
To override any configuration value for your local development, copy `src/mt5.ini` to `src/mt5-dev.ini` and customize as needed.  
The `src/mt5-dev.ini` file is ignored by git and will not be tracked or pushed.


## Version Control

- The project is initialized as a git repository on first container start.
- All code, configuration, and documentation are versioned.

---

## References

- See `docs/To programmatically run strategy optimiz.md` for research and technical background.
- For more details on the MCP server and API, see the inline documentation in each source file.

---

## Maintenance

- Always update this README and commit changes to git when modifying the workflow, API, or server logic.

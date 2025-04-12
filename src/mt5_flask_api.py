import os
import uuid
import threading
import json
from flask import Flask, request, jsonify
import MetaTrader5 as mt5
import pandas as pd
from jinja2 import Environment, FileSystemLoader

app = Flask(__name__)
optimizations = {}

RESULTS_DIR = "result/manual/tuning"
os.makedirs(RESULTS_DIR, exist_ok=True)

def run_mt5_optimization(opt_id, params):
    # This is a placeholder for actual MT5 optimization logic.
    # In a real implementation, you would configure and run the MT5 strategy tester here.
    # For demonstration, we simulate results.
    import time
    time.sleep(2)  # Simulate optimization time

    # Simulated results
    results = []
    for tp in range(params["params"]["TakeProfit"]["min"], params["params"]["TakeProfit"]["max"]+1, params["params"]["TakeProfit"]["step"]):
        for sl in range(params["params"]["StopLoss"]["min"], params["params"]["StopLoss"]["max"]+1, params["params"]["StopLoss"]["step"]):
            profit = tp * 2 - sl  # Dummy formula
            drawdown = sl * 0.1
            results.append({
                "TakeProfit": tp,
                "StopLoss": sl,
                "Profit": profit,
                "Drawdown": drawdown
            })
    df = pd.DataFrame(results)
    best_row = df.sort_values("Profit", ascending=False).iloc[0]
    optimizations[opt_id] = {
        "status": "completed",
        "params": params,
        "results": results,
        "best": best_row.to_dict()
    }

@app.route('/optimize', methods=['POST'])
def optimize():
    params = request.json
    opt_id = str(uuid.uuid4())
    optimizations[opt_id] = {"status": "running", "params": params}
    thread = threading.Thread(target=run_mt5_optimization, args=(opt_id, params))
    thread.start()
    return jsonify({"optimization_id": opt_id})

@app.route('/optimization_status/<opt_id>')
def optimization_status(opt_id):
    if opt_id not in optimizations:
        return jsonify({"status": "not_found"}), 404
    return jsonify({"status": optimizations[opt_id]["status"]})

@app.route('/optimization_results/<opt_id>')
def optimization_results(opt_id):
    if opt_id not in optimizations or optimizations[opt_id]["status"] != "completed":
        return jsonify({"error": "not ready"}), 400
    return jsonify({
        "results": optimizations[opt_id]["results"],
        "best": optimizations[opt_id]["best"]
    })

@app.route('/save_results', methods=['POST'])
def save_results():
    data = request.json
    opt_id = data["optimization_id"]
    ea_name = data.get("ea_name", "EA")
    if opt_id not in optimizations or optimizations[opt_id]["status"] != "completed":
        return jsonify({"error": "not ready"}), 400
    df = pd.DataFrame(optimizations[opt_id]["results"])
    best = optimizations[opt_id]["best"]

    # Save Markdown
    md_path = os.path.join(RESULTS_DIR, f"{ea_name}_tuning.md")
    with open(md_path, "w") as f:
        f.write(f"# Optimization Results for {ea_name}\n\n")
        f.write(f"**Best Parameters:**\n\n")
        for k, v in best.items():
            f.write(f"- **{k}**: {v}\n")
        f.write("\n## All Results\n\n")
        f.write(df.to_markdown(index=False))
    # Save HTML
    html_path = os.path.join(RESULTS_DIR, f"{ea_name}_tuning.html")
    env = Environment(loader=FileSystemLoader(os.path.dirname(__file__)))
    template_str = """
    <html>
    <head>
        <title>Optimization Results for {{ ea_name }}</title>
        <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ccc; padding: 8px; }
            th { background: #eee; }
        </style>
    </head>
    <body>
        <h1>Optimization Results for {{ ea_name }}</h1>
        <h2>Best Parameters</h2>
        <ul>
        {% for k, v in best.items() %}
            <li><b>{{ k }}</b>: {{ v }}</li>
        {% endfor %}
        </ul>
        <h2>All Results</h2>
        {{ table | safe }}
    </body>
    </html>
    """
    template = env.from_string(template_str)
    html = template.render(ea_name=ea_name, best=best, table=df.to_html(index=False))
    with open(html_path, "w") as f:
        f.write(html)
    # Optionally save CSV/JSON
    if data.get("format") == "csv":
        csv_path = os.path.join(RESULTS_DIR, f"{ea_name}_tuning.csv")
        df.to_csv(csv_path, index=False)
    if data.get("format") == "json":
        json_path = os.path.join(RESULTS_DIR, f"{ea_name}_tuning.json")
        df.to_json(json_path, orient="records")
    return jsonify({
        "success": True,
        "md_path": md_path,
        "html_path": html_path
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

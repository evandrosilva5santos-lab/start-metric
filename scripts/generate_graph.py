import os, sys, json, re
from pathlib import Path
import networkx as nx
from collections import defaultdict

root = Path("/Volumes/Vol Macbook/App/TRAFEGO PAGO")
out_dir = root / "graphify-out"
out_dir.mkdir(exist_ok=True)

G = nx.Graph()

extensions = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".md", ".sql", ".css"}
ignore_dirs = {".git", "node_modules", ".turbo", ".next", "dist", "build", ".cache", "graphify-out", ".archive", ".vscode", ".claude"}

all_nodes = {}
edges = []

for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in ignore_dirs and not d.startswith("._")]
    for f in filenames:
        if f.startswith("._"):
            continue
        p = Path(dirpath) / f
        if p.suffix in extensions:
            rel_path = str(p.relative_to(root))
            node_type = "code" if p.suffix in {".ts", ".tsx", ".js", ".jsx", ".mjs"} else "doc" if p.suffix == ".md" else "config" if p.suffix in {".json"} else "db" if p.suffix == ".sql" else "style"
            try:
                size = p.stat().st_size
            except Exception:
                size = 0
            G.add_node(rel_path, label=p.name, type=node_type, path=rel_path, size=size)
            all_nodes[rel_path] = {"id": rel_path, "label": p.name, "type": node_type, "size": size}

import_regex = re.compile(r'(?:import|from|require)\s*\(?[\'"]([^\'"]+)[\'"]')
link_regex = re.compile(r'\[.*?\]\((file:///?[^\)]+|\./[^\)]+|[a-zA-Z0-9_\-\.\/]+\.md)\)')

for node_id, data in all_nodes.items():
    file_path = root / node_id
    try:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        continue
        
    if data["type"] == "code":
        for imp in import_regex.findall(content):
            if imp.startswith("."):
                curr_dir = file_path.parent
                cand = (curr_dir / imp).resolve()
                cand_rels = [
                    str(cand.relative_to(root)) if cand.is_relative_to(root) else None,
                    str((cand.with_suffix(".ts")).relative_to(root)) if (cand.with_suffix(".ts")).is_relative_to(root) else None,
                    str((cand.with_suffix(".tsx")).relative_to(root)) if (cand.with_suffix(".tsx")).is_relative_to(root) else None,
                    str((cand.with_suffix(".js")).relative_to(root)) if (cand.with_suffix(".js")).is_relative_to(root) else None,
                    str((cand / "index.ts").relative_to(root)) if (cand / "index.ts").is_relative_to(root) else None,
                    str((cand / "index.tsx").relative_to(root)) if (cand / "index.tsx").is_relative_to(root) else None,
                ]
                for cr in cand_rels:
                    if cr and cr in G:
                        G.add_edge(node_id, cr, relation="imports")
                        edges.append({"source": node_id, "target": cr, "relation": "imports"})
                        break
            elif imp.startswith("@/"):
                sub = imp[2:]
                cands = [
                    f"apps/dashboard/src/{sub}",
                    f"apps/dashboard/src/{sub}.ts",
                    f"apps/dashboard/src/{sub}.tsx",
                    f"apps/dashboard/src/{sub}/index.ts",
                    f"apps/dashboard/src/{sub}/index.tsx",
                ]
                for c in cands:
                    if c in G:
                        G.add_edge(node_id, c, relation="imports")
                        edges.append({"source": node_id, "target": c, "relation": "imports"})
                        break
    elif data["type"] == "doc":
        for link in link_regex.findall(content):
            clean_link = link.replace("file://", "").split("#")[0].lstrip("./")
            if clean_link in G:
                G.add_edge(node_id, clean_link, relation="references")
                edges.append({"source": node_id, "target": clean_link, "relation": "references"})

communities = list(nx.community.greedy_modularity_communities(G))
comm_map = {}
for idx, comm in enumerate(communities):
    for n in comm:
        comm_map[n] = idx
        G.nodes[n]["community"] = idx

degree_cent = nx.degree_centrality(G)
god_nodes_sorted = sorted(degree_cent.items(), key=lambda x: x[1], reverse=True)[:10]

print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities.")
print("Top God Nodes:")
for n, c in god_nodes_sorted[:5]:
    print(f" - {n}: {c:.3f} (deg: {G.degree[n]})")

graph_data = {
    "nodes": [{"id": n, **G.nodes[n]} for n in G.nodes()],
    "edges": [{"source": u, "target": v, **G.edges[u, v]} for u, v in G.edges()],
    "stats": {
        "nodes_count": G.number_of_nodes(),
        "edges_count": G.number_of_edges(),
        "communities_count": len(communities)
    }
}
(out_dir / "graph.json").write_text(json.dumps(graph_data, indent=2, ensure_ascii=False))

report = f"""# GRAPH_REPORT — Architecture Knowledge Graph

## Overview
- **Total Nodes**: {G.number_of_nodes()}
- **Total Relationships/Edges**: {G.number_of_edges()}
- **Communities Detected**: {len(communities)}

## God Nodes (Most Central Architecture Elements)
"""
for n, c in god_nodes_sorted:
    report += f"- **`{n}`** (Degree: {G.degree[n]}, Centrality: {c:.3f})\n"

report += "\n## Communities & Subsystems\n"
for idx, comm in enumerate(communities):
    sample = list(comm)[:6]
    report += f"### Community {idx+1} ({len(comm)} nodes)\n"
    for s in sample:
        report += f"- `{s}`\n"
    if len(comm) > 6:
        report += f"- *... and {len(comm) - 6} more*\n"
    report += "\n"

(out_dir / "GRAPH_REPORT.md").write_text(report)

html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Knowledge Graph - Tráfego Pago</title>
    <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
    <style>
        body {{ margin: 0; background: #0f172a; color: #f8fafc; font-family: -apple-system, sans-serif; }}
        #header {{ padding: 16px 24px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; }}
        #mynetwork {{ width: 100vw; height: calc(100vh - 65px); }}
    </style>
</head>
<body>
    <div id="header">
        <div><strong>Tráfego Pago — Knowledge Graph</strong> ({G.number_of_nodes()} nós, {G.number_of_edges()} conexões)</div>
        <div>Comunidades: {len(communities)}</div>
    </div>
    <div id="mynetwork"></div>
    <script>
        const nodes = new vis.DataSet({json.dumps([{'id': n, 'label': G.nodes[n]['label'], 'group': G.nodes[n].get('community', 0), 'title': n} for n in G.nodes()])});
        const edges = new vis.DataSet({json.dumps([{'from': u, 'to': v} for u, v in G.edges()])});
        const container = document.getElementById('mynetwork');
        const data = {{ nodes: nodes, edges: edges }};
        const options = {{
            nodes: {{ shape: 'dot', size: 16, font: {{ color: '#ffffff', size: 12 }} }},
            edges: {{ color: {{ color: '#64748b' }}, smooth: true }},
            physics: {{ stabilization: true, barnesHut: {{ gravitationalConstant: -3000, springLength: 95 }} }}
        }};
        new vis.Network(container, data, options);
    </script>
</body>
</html>
"""
(out_dir / "graph.html").write_text(html_content)
print("Graph complete!")

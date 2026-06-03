# ── Stage 1: build the React/Webpack frontend ─────────────────────────────
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
# Webpack 4 requires --openssl-legacy-provider; pass it directly to node
# to avoid NODE_OPTIONS restrictions on Node 17+.
RUN NODE_ENV=production node --openssl-legacy-provider \
    node_modules/.bin/webpack --mode production --config webpack.config.js

# ── Stage 2: Python runtime ────────────────────────────────────────────────
FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential g++ gdb libstdc++-12-dev \
    && rm -rf /var/lib/apt/lists/*

# python:3.13-slim installs the stdlib at /usr/local/lib/python3.13, but
# GDB's embedded Python looks at /usr/lib/python3.13 — fix sys.path so
# libstdc++ pretty-printers load correctly.
RUN printf 'set auto-load safe-path /\nset breakpoint pending on\npython\nimport sys\nfor p in ["/usr/local/lib/python3.13","/usr/local/lib/python3.13/lib-dynload","/usr/share/gcc/python"]:\n    if p not in sys.path: sys.path.insert(0, p)\nfrom libstdcxx.v6.printers import register_libstdcxx_printers\nregister_libstdcxx_printers(None)\nend\n' > /root/.gdbinit

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .
COPY --from=frontend-builder /app/gdbgui/static/js/ ./gdbgui/static/js/

RUN pip install -e . --no-deps

EXPOSE 5000
CMD ["python", "-m", "gdbgui", "--host=0.0.0.0", "--port=5000"]

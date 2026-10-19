#!/usr/bin/env bash
export PATH="$HOME/.local/node/bin:$PATH"
cd /home/ndrs/www/tickets_front
npx vite preview --host 0.0.0.0 --port 4173 --strictPort

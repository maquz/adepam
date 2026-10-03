# Tailor Measurement Cards

Static web app (Vite + TypeScript + Tailwind). Data is stored in the browser's LocalStorage.

## Run locally
    npm install
    npm run dev

## Build and self-host
    npm run build

Upload the contents of `dist/` to any static host (Nginx, Apache, Netlify, GitHub Pages, etc.).
There is no server or database: each browser keeps its own saved clients.

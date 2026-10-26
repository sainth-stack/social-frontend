import { themeInitializationScript } from "./theme";

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script>${themeInitializationScript}</script>
    <style>
      :root { color-scheme: light; --background: #fffaf5; --foreground: #18181b; --card: #ffffff; --muted: #6b5b50; --primary: #c2410c; --primary-hover: #9a3412; --primary-foreground: #ffffff; --border: #e7d9cc; }
      .dark { color-scheme: dark; --background: #181411; --foreground: #fff7ed; --card: #241e19; --muted: #c4b5a9; --primary: #fb923c; --primary-hover: #fdba74; --primary-foreground: #24140b; --border: #493b32; }
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: var(--background); color: var(--foreground); display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: var(--muted); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: var(--primary); color: var(--primary-foreground); }
      .primary:hover { background: var(--primary-hover); }
      .secondary { background: var(--card); color: var(--foreground); border-color: var(--border); }
      :focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}

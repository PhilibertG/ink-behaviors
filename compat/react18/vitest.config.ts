import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Same tests as the main run, but `react`, `ink` and `ink-testing-library`
// come from this folder's node_modules: React 18 and Ink 5.
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here('../..'),
  resolve: {
    alias: [
      { find: /^react$/, replacement: here('./node_modules/react/index.js') },
      { find: /^react\/jsx-runtime$/, replacement: here('./node_modules/react/jsx-runtime.js') },
      { find: /^react\/jsx-dev-runtime$/, replacement: here('./node_modules/react/jsx-dev-runtime.js') },
      { find: /^ink$/, replacement: here('./node_modules/ink/build/index.js') },
      { find: /^ink-testing-library$/, replacement: here('./node_modules/ink-testing-library/build/index.js') },
    ],
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    env: { INK_BEHAVIORS_COMPAT: 'react18' },
  },
});

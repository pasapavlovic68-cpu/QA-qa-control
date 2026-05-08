import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/QA-qa-control/' : '/',
  esbuild: {
    jsx: 'automatic'
  }
});

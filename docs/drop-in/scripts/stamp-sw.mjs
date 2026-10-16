// Generates public/sw.js from sw-src/sw.js, replacing __BUILD_ID__.
// Wired up via package.json "predev" and "prebuild".
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function buildId() {
  if (process.env.npm_lifecycle_event === 'predev') return 'dev';
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8);
  try {
    return execSync('git rev-parse --short=8 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return Date.now().toString(36); // no git (e.g. zip upload): still unique per build
  }
}

const id = buildId();
const src = readFileSync('sw-src/sw.js', 'utf8');
if (!src.includes('__BUILD_ID__')) throw new Error('sw-src/sw.js is missing the __BUILD_ID__ placeholder');
writeFileSync('public/sw.js', src.replaceAll('__BUILD_ID__', id));
console.log(`[stamp-sw] public/sw.js generated, build id = ${id}`);

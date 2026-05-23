#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const EXPECTED_URLS = {
  development: 'https://picgzvmhevhznzowkdhv.supabase.co',
  production: 'https://nfoshumnlfsjtfxkyqrq.supabase.co',
};

const REQUIRED_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
];

const mode = process.argv[2];

if (!Object.keys(EXPECTED_URLS).includes(mode)) {
  fail(`Usage: node scripts/validate-public-env.js <development|production>`);
}

const appDir = path.resolve(__dirname, '..');
const env = {
  ...loadEnvFile(path.join(appDir, '.env')),
  ...loadEnvFile(path.join(appDir, `.env.${mode}`)),
  ...process.env,
};

const missing = REQUIRED_KEYS.filter((key) => !env[key]);

if (missing.length > 0) {
  fail(`Missing required public Expo env var(s): ${missing.join(', ')}`);
}

const actualUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const expectedUrl = EXPECTED_URLS[mode];

if (actualUrl !== expectedUrl) {
  fail(
    `${mode} expected EXPO_PUBLIC_SUPABASE_URL=${expectedUrl}, but got ${actualUrl}`
  );
}

if (mode === 'production' && actualUrl === EXPECTED_URLS.development) {
  fail('Production is pointing at the development Supabase project.');
}

console.log(`Public Expo env validated for ${mode}.`);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const contents = fs.readFileSync(filePath, 'utf8');

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    values[key] = stripQuotes(rawValue);
  }

  return values;
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function fail(message) {
  console.error(`Env validation failed: ${message}`);
  process.exit(1);
}

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const EXPECTED_URLS = {
  development: 'https://picgzvmhevhznzowkdhv.supabase.co',
  production: 'https://nfoshumnlfsjtfxkyqrq.supabase.co',
};

const EXPECTED_ANON_KEYS = {
  development: 'sb_publishable_-XpUrOe1JzhKZ_dv-PMnzA_8UN5NioX',
  production: 'sb_publishable_tV5Yx4MiEokwXvjW15geJQ_9qcV_RI_',
};

const PUBLIC_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

const SERVER_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
];

const mode = process.argv[2];

if (!Object.keys(EXPECTED_URLS).includes(mode)) {
  fail('Usage: node scripts/validate-env.js <development|production>');
}

const appDir = path.resolve(__dirname, '..');
const envFiles = [
  path.join(appDir, '.env'),
  path.join(appDir, '.env.local'),
  path.join(appDir, `.env.${mode}`),
  path.join(appDir, `.env.${mode}.local`),
];
const env = {
  ...loadEnvFiles(envFiles),
  ...process.env,
};

const missing = [...PUBLIC_KEYS, ...SERVER_KEYS].filter((key) => !env[key]);

if (missing.length > 0) {
  fail(`Missing required web env var(s): ${missing.join(', ')}`);
}

validateValue('NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL, EXPECTED_URLS[mode]);
validateValue('SUPABASE_URL', env.SUPABASE_URL, EXPECTED_URLS[mode]);
validateValue(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  EXPECTED_ANON_KEYS[mode]
);
validateValue('SUPABASE_ANON_KEY', env.SUPABASE_ANON_KEY, EXPECTED_ANON_KEYS[mode]);

console.log(`Web env validated for ${mode}.`);

function validateValue(key, actual, expected) {
  if (actual !== expected) {
    fail(`${mode} expected ${key}=${expected}, but got ${actual}`);
  }
}

function loadEnvFiles(filePaths) {
  return filePaths.reduce(
    (values, filePath) => ({
      ...values,
      ...loadEnvFile(filePath),
    }),
    {}
  );
}

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
  console.error(`Web env validation failed: ${message}`);
  process.exit(1);
}

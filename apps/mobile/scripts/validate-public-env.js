#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const EXPECTED_URLS = {
  development: 'https://picgzvmhevhznzowkdhv.supabase.co',
  production: 'https://nfoshumnlfsjtfxkyqrq.supabase.co',
};

const EXPECTED_APP_VARIANTS = {
  development: 'development',
  production: 'production',
};

const REQUIRED_KEYS = [
  'EXPO_PUBLIC_APP_VARIANT',
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
];

const mode = process.argv[2];

if (!Object.keys(EXPECTED_URLS).includes(mode)) {
  fail(`Usage: node scripts/validate-public-env.js <development|production>`);
}

const appDir = path.resolve(__dirname, '..');
const envFiles = [
  path.join(appDir, '.env'),
  path.join(appDir, '.env.local'),
  path.join(appDir, `.env.${mode}`),
  path.join(appDir, `.env.${mode}.local`),
];
const env = {
  ...loadEasProfileEnv(appDir, mode),
  ...loadEnvFiles(envFiles),
  ...process.env,
};

const missing = REQUIRED_KEYS.filter((key) => !env[key]);

if (missing.length > 0) {
  fail(`Missing required public Expo env var(s): ${missing.join(', ')}`);
}

const actualUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const expectedUrl = EXPECTED_URLS[mode];
const actualAppVariant = env.EXPO_PUBLIC_APP_VARIANT;
const expectedAppVariant = EXPECTED_APP_VARIANTS[mode];

if (actualAppVariant !== expectedAppVariant) {
  fail(
    `${mode} expected EXPO_PUBLIC_APP_VARIANT=${expectedAppVariant}, but got ${actualAppVariant}`
  );
}

if (actualUrl !== expectedUrl) {
  fail(
    `${mode} expected EXPO_PUBLIC_SUPABASE_URL=${expectedUrl}, but got ${actualUrl}`
  );
}

if (mode === 'production' && actualUrl === EXPECTED_URLS.development) {
  fail('Production is pointing at the development Supabase project.');
}

if (mode === 'development' && actualUrl === EXPECTED_URLS.production) {
  fail('Development is pointing at the production Supabase project.');
}

const conflictingLocalFiles = [
  path.join(appDir, '.env.local'),
  path.join(appDir, `.env.${mode}.local`),
].flatMap((filePath) => {
  const values = loadEnvFile(filePath);
  const conflicts = [];

  for (const key of REQUIRED_KEYS) {
    const expectedValue = getExpectedValue(key);

    if (expectedValue && values[key] && values[key] !== expectedValue) {
      conflicts.push(`${path.basename(filePath)} has ${key}=${values[key]}`);
    }
  }

  return conflicts;
});

if (conflictingLocalFiles.length > 0) {
  fail(
    `Local env override conflicts with ${mode}: ${conflictingLocalFiles.join(', ')}`
  );
}

console.log(`Public Expo env validated for ${mode}.`);

function getExpectedValue(key) {
  if (key === 'EXPO_PUBLIC_APP_VARIANT') {
    return expectedAppVariant;
  }

  if (key === 'EXPO_PUBLIC_SUPABASE_URL') {
    return expectedUrl;
  }

  return null;
}

function loadEasProfileEnv(appDir, mode) {
  const easJsonPath = path.join(appDir, 'eas.json');

  if (!fs.existsSync(easJsonPath)) {
    return {};
  }

  const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
  return easJson.build?.[mode]?.env ?? {};
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
  console.error(`Env validation failed: ${message}`);
  process.exit(1);
}

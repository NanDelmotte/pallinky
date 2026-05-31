#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const VARIANTS = {
  development: {
    APP_VARIANT: 'development',
    NEXT_PUBLIC_SUPABASE_URL: 'https://picgzvmhevhznzowkdhv.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_-XpUrOe1JzhKZ_dv-PMnzA_8UN5NioX',
    SUPABASE_URL: 'https://picgzvmhevhznzowkdhv.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_-XpUrOe1JzhKZ_dv-PMnzA_8UN5NioX',
  },
  production: {
    APP_VARIANT: 'production',
    NEXT_PUBLIC_SUPABASE_URL: 'https://nfoshumnlfsjtfxkyqrq.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_tV5Yx4MiEokwXvjW15geJQ_9qcV_RI_',
    SUPABASE_URL: 'https://nfoshumnlfsjtfxkyqrq.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_tV5Yx4MiEokwXvjW15geJQ_9qcV_RI_',
  },
};

const [mode, command, ...commandArgs] = process.argv.slice(2);

if (!VARIANTS[mode] || !command) {
  console.error('Usage: node scripts/run-with-env.js <development|production> <command> [...args]');
  process.exit(1);
}

const appDir = path.resolve(__dirname, '..');
const env = {
  ...process.env,
  ...VARIANTS[mode],
};

const validation = spawnSync(process.execPath, ['scripts/validate-env.js', mode], {
  cwd: appDir,
  env,
  stdio: 'inherit',
});

if (validation.status !== 0) {
  process.exit(validation.status ?? 1);
}

const result = spawnSync(command, commandArgs, {
  cwd: appDir,
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

process.exit(result.status ?? 1);

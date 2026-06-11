#!/usr/bin/env node

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const USER_DIR = process.env.FOLLOW_BUILDERS_USER_DIR || join(homedir(), '.follow-builders');
const CONFIG_PATH = join(USER_DIR, 'config.json');
const ENV_PATH = join(USER_DIR, '.env');

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

async function main() {
  const toEmail = requireEnv('DIGEST_TO_EMAIL');
  const resendApiKey = requireEnv('RESEND_API_KEY');
  const language = (process.env.DIGEST_LANGUAGE || 'zh').trim();
  const fromEmail = (process.env.RESEND_FROM_EMAIL || '').trim();

  await mkdir(USER_DIR, { recursive: true });

  const config = {
    language,
    frequency: 'daily',
    delivery: {
      method: 'email',
      email: toEmail,
      ...(fromEmail ? { fromEmail } : {})
    }
  };

  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');

  const envLines = [
    `RESEND_API_KEY=${resendApiKey}`,
    ...(fromEmail ? [`RESEND_FROM_EMAIL=${fromEmail}`] : [])
  ];
  await writeFile(ENV_PATH, `${envLines.join('\n')}\n`, 'utf-8');

  console.error(`Cloud runtime config written to ${USER_DIR}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
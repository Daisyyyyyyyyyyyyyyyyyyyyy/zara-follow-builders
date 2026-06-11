#!/usr/bin/env node

import { execFile } from 'child_process';
import { promisify } from 'util';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PREPARE_SCRIPT = join(SCRIPT_DIR, 'prepare-digest.js');
const DEFAULT_BASE_URL = 'https://api.z.ai/api/coding/paas/v4';
const DEFAULT_MODEL = 'glm-4.7';
const REQUEST_TIMEOUT_MS = 180000;

const SYSTEM_PROMPT = [
  'You are writing an AI Builders daily digest from structured JSON prepared by the follow-builders project.',
  'Only use information contained in the provided JSON.',
  'Never invent facts, titles, links, or context that is not present in the JSON.',
  'Every included item must contain its original URL.',
  'Read and follow the prompt files embedded inside the JSON object, especially digest_intro, summarize_tweets, summarize_podcast, summarize_blogs, and translate.',
  'Follow config.language exactly: en, zh, or bilingual.',
  'Return only the final digest text with no code fences, no JSON, and no commentary about your process.'
].join(' ');

function getEnv(name, fallback = '') {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function extractTextContent(content) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item.text === 'string') return item.text;
        if (item?.type === 'text' && typeof item?.text === 'string') return item.text;
        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

async function loadPreparedContext() {
  const { stdout, stderr } = await execFileAsync(process.execPath, [PREPARE_SCRIPT], {
    cwd: SCRIPT_DIR,
    maxBuffer: 50 * 1024 * 1024,
    env: process.env
  });

  if (stderr && stderr.trim()) {
    console.error(stderr.trim());
  }

  return JSON.parse(stdout);
}

function buildNoContentDigest(language) {
  if (language === 'zh') {
    return '今天的 Follow Builders 源没有抓到新的可发送内容。';
  }

  if (language === 'bilingual') {
    return [
      'No new Follow Builders items were available in the latest feed today.',
      '',
      '今天的 Follow Builders 源没有抓到新的可发送内容。'
    ].join('\n');
  }

  return 'No new Follow Builders items were available in the latest feed today.';
}

async function requestDigest(preparedContext) {
  const apiKey = getEnv('GLM_API_KEY') || getEnv('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('GLM_API_KEY (or OPENAI_API_KEY) is required');
  }

  const baseUrl = (getEnv('GLM_BASE_URL') || getEnv('OPENAI_BASE_URL') || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = getEnv('GLM_MODEL') || getEnv('OPENAI_MODEL') || DEFAULT_MODEL;

  const userPrompt = [
    'Create today\'s digest from the following JSON payload.',
    'The JSON already contains the source content, configuration, prompts, and stats.',
    'Return only the final digest text.',
    '',
    JSON.stringify(preparedContext)
  ].join('\n');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GLM API error (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  const digest = extractTextContent(payload?.choices?.[0]?.message?.content);

  if (!digest) {
    throw new Error('GLM API returned an empty digest');
  }

  return digest;
}

async function main() {
  const preparedContext = await loadPreparedContext();
  const totalItems =
    (preparedContext?.stats?.podcastEpisodes || 0) +
    (preparedContext?.stats?.totalTweets || 0) +
    (preparedContext?.stats?.blogPosts || 0);

  if (totalItems === 0) {
    process.stdout.write(buildNoContentDigest(preparedContext?.config?.language || 'en'));
    return;
  }

  const digest = await requestDigest(preparedContext);
  process.stdout.write(`${digest.trim()}\n`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
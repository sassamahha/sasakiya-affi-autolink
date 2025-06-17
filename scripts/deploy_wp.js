// scripts/deploy_wp.js
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const { WP_BASE_URL, WP_USER, WP_APP_PW } = process.env;
if (!WP_BASE_URL || !WP_USER || !WP_APP_PW) {
  console.error('❌  WP_BASE_URL / WP_USER / WP_APP_PW が未設定');
  process.exit(1);
}

const AUTH = Buffer.from(`${WP_USER}:${WP_APP_PW}`).toString('base64');
const headers = {
  Authorization: `Basic ${AUTH}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'gh-actions-affi/1.0'
};
const API = `${WP_BASE_URL.replace(/\/$/, '')}/wp-json/wp/v2`;
const PER_PAGE = 100;                 // ← max に変更

// ─── ローカル記事一覧（slug ⇔ file） ───────────────
const mdFiles = fs
  .readdirSync('content/posts')
  .filter((f) => /\.mdx?$/.test(f))
  .map((f) => ({
    slug: path.basename(f, path.extname(f)),
    file: `content/posts/${f}`
  }));

// ─── WP 全記事をページングで取得 → 更新 ──────────
let page = 1;
while (true) {
  const resList = await fetch(`${API}/posts?per_page=${PER_PAGE}&page=${page}`, { headers });
  if (!resList.ok) {
    console.error('GET posts failed', resList.status, await resList.text());
    process.exit(1);
  }
  const posts = await resList.json();
  if (!posts.length) break;           // 取得完了

  for (const post of posts) {
    const local = mdFiles.find((m) => m.slug === post.slug);
    if (!local) continue;             // 対応する MD が無い記事は無視

    const content = fs.readFileSync(local.file, 'utf8');
    // 同一内容ならスキップ
    if (post.content?.rendered?.includes(content)) continue;

    const resSave = await fetch(`${API}/posts/${post.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ content })
    });
    if (!resSave.ok) {
      console.error('PUT failed', resSave.status, await resSave.text());
      process.exit(1);
    }
    const saved = await resSave.json();
    console.log(`PUT success → ${saved.link}`);
  }

  page++;                              // 次ページへ
}

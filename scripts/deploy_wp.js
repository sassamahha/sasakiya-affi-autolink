// scripts/deploy_wp.js
import fs from 'fs';
import fetch from 'node-fetch';

const { WP_BASE_URL, WP_USER, WP_APP_PW } = process.env;
const AUTH = Buffer.from(`${WP_USER}:${WP_APP_PW}`).toString('base64');
const headers = {
  Authorization: `Basic ${AUTH}`,
  'Content-Type': 'application/json',
  Accept: 'application/json'
};

const API = `${WP_BASE_URL}/wp-json/wp/v2`;
const file = 'content/posts/test.md';          // 今回はテスト記事
const slug = 'test';                           // ← ファイル名ベースでも OK
const content = fs.readFileSync(file, 'utf8');

// ① slug で検索
const resFind = await fetch(`${API}/posts?slug=${slug}`, { headers });
const list = await resFind.json();
const id = list.length ? list[0].id : null;

// ② 新規 or 更新
const method = id ? 'PUT' : 'POST';
const url = id ? `${API}/posts/${id}` : `${API}/posts`;
const payload = JSON.stringify({
  title: slug,
  content,
  status: 'publish',
  slug
});

const resSave = await fetch(url, { method, headers, body: payload });
if (!resSave.ok) {
  console.error(`${method} error`, resSave.status, await resSave.text());
  process.exit(1);
}
console.log(`${method} success →`, (await resSave.json()).link);

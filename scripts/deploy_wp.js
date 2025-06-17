// scripts/deploy_wp.js
import fs from 'fs';
import fetch from 'node-fetch';

const { WP_BASE_URL, WP_USER, WP_APP_PW } = process.env;
const auth = Buffer.from(`${WP_USER}:${WP_APP_PW}`).toString('base64');
const baseHeaders = {
  'Authorization': `Basic ${auth}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

// ① slug と本文を用意
const file = 'content/posts/test.md';
const slug = 'test';                              // 好きなルールで
const content = fs.readFileSync(file, 'utf8');

// ② slug で既存記事を探す
const resFind = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/posts?slug=${slug}`, { headers: baseHeaders });
if (!resFind.ok) {
  console.error('Find error', resFind.status, await resFind.text());
  process.exit(1);
}
const existing = await resFind.json();
const id = existing.length ? existing[0].id : null;

// ③ 本文を JSON に
const payload = JSON.stringify({
  title: slug,
  content,
  status: 'publish',
  slug
});

// ④ 新規 or 更新
const url = id
  ? `${WP_BASE_URL}/wp-json/wp/v2/posts/${id}`
  : `${WP_BASE_URL}/wp-json/wp/v2/posts`;
const method = id ? 'PUT' : 'POST';

const resSave = await fetch(url, { method, headers: baseHeaders, body: payload });
if (!resSave.ok) {
  console.error('Save error', resSave.status, await resSave.text());
  process.exit(1);
}
console.log(`${method} success ⇒`, (await resSave.json()).link);

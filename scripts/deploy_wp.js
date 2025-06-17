import fs from 'fs';
import fetch from 'node-fetch';

const { WP_BASE_URL, WP_USER, WP_APP_PW } = process.env;
const auth = Buffer.from(`${WP_USER}:${WP_APP_PW}`).toString('base64');
const headers = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };

const slug = 'test-article';              // ←ファイル名 → slug にするなど
const content = fs.readFileSync('content/posts/test.md', 'utf8');

// 既存記事チェック
let id;
const res = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/posts?slug=${slug}`);
const json = await res.json();
if (json.length) id = json[0].id;

const body = JSON.stringify({ title: slug, content, status: 'publish', slug });

const url = id 
  ? `${WP_BASE_URL}/wp-json/wp/v2/posts/${id}`   // PUT 更新
  : `${WP_BASE_URL}/wp-json/wp/v2/posts`;        // POST 新規

await fetch(url, { method: id ? 'PUT' : 'POST', headers, body });
console.log('WP deploy done');

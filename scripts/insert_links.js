// scripts/insert_links.js
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import unified from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import * as cheerio from 'cheerio';

// ─── データ読み込み ──────────────────────────────
const P = JSON.parse(fs.readFileSync('data/product_map.json', 'utf8'));     // shop.sassamahha.me 用
const C = JSON.parse(fs.readFileSync('data/collection_map.json', 'utf8'));  // コレクション
const K = JSON.parse(fs.readFileSync('data/keyword_map.json', 'utf8'));     // Amazon アフィ
K.sort((a, b) => b.keyword.length - a.keyword.length);                      // 長い語句を先に

// ─── 正規化ユーティリティ（超簡易版） ───────────────
const normalize = (s = '') =>
  s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)) // ｶﾀｶﾅ→ひらがな
    .toLowerCase();

// ─── ★ 変更検知 → “全ファイル” へ切替 ★ ────────────
const changed = execSync('git ls-files')
  .toString()
  .trim()
  .split('\n')
  .filter((f) => /\.(mdx?|html?)$/i.test(f));          // リポジトリ内すべての md / html

// ─── 変換ループ ────────────────────────────────
for (const file of changed) {
  const ext = path.extname(file);
  const raw = fs.readFileSync(file, 'utf8');
  let updated = raw;

  // ---------- Markdown -------------------------
  if (ext === '.md' || ext === '.mdx') {
    const tree = unified().use(remarkParse).parse(raw);

    visit(tree, 'text', (node) => {
      let txt = node.value;

      // 商品・コレクション
      [...P, ...C].forEach(({ title, url }) => {
        const re = new RegExp(`\\b${title}\\b`, 'g');
        txt = txt.replace(re, `[${title}](${url})`);
      });

      // Amazon アフィ用キーワード
      K.forEach(({ keyword, tag }) => {
        const re = new RegExp(`\\b${keyword}\\b`, 'g');
        const link = `https://www.amazon.co.jp/s?k=${encodeURIComponent(tag)}&tag=sassa0a-22`;
        txt = txt.replace(re, `[${keyword}](${link})`);
      });

      node.value = txt;
    });

    updated = unified().use(remarkStringify).stringify(tree);
  }

  // ---------- HTML -----------------------------
  else {
    const $ = cheerio.load(raw);

    $('body')
      .find('*')
      .contents()
      .filter((_, el) => el.type === 'text')
      .each((_, el) => {
        let txt = $(el).text();

        [...P, ...C].forEach(({ title, url }) => {
          const re = new RegExp(`\\b${title}\\b`, 'g');
          txt = txt.replace(re, `<a href="${url}">${title}</a>`);
        });

        K.forEach(({ keyword, tag }) => {
          const re = new RegExp(`\\b${keyword}\\b`, 'g');
          const link = `https://www.amazon.co.jp/s?k=${encodeURIComponent(tag)}&tag=sassa0a-22`;
          txt = txt.replace(re, `<a href="${link}">${keyword}</a>`);
        });

        $(el).replaceWith(txt);
      });

    updated = $.html();
  }

  // ---------- ファイル保存 -----------------------
  if (updated !== raw) {
    fs.writeFileSync(file, updated);
    console.log(`✔ linked ${file}`);
  }
}

// scripts/insert_links.js
//--------------------------------------------------------------
// 1. data/*.json からリンクルールを生成（①②③の優先順）
// 2. 既存 <a>…</a> をいったん “トークン化” して保護
// 3. プレーンテキストだけ置換してリンク化
// 4. トークンを元の <a> に戻して完成
//--------------------------------------------------------------
import fs   from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('data');

// RegExp 用にメタ文字をエスケープ
const esc = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- ①②③ ルールを組み立て ----------
async function buildRules () {
  const [prod, coll, kw] = await Promise.all([
    fs.readFile(path.join(root, 'product_map.json'),    'utf8').then(JSON.parse),
    fs.readFile(path.join(root, 'collection_map.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.join(root, 'keyword_map.json'),    'utf8').then(JSON.parse)
  ]);

  const rules = [];

  // ① 商品ページ（最優先）
  rules.push(
    ...prod.map(({ title, slug }) => ({
      regexp: new RegExp(esc(title), 'gi'),
      href:   `https://shop.sassamahha.me/products/${slug}`
    }))
  );

  // ② コレクションページ
  rules.push(
    ...coll.map(({ title, slug }) => ({
      regexp: new RegExp(esc(title), 'gi'),
      href:   `https://shop.sassamahha.me/collections/${slug}`
    }))
  );

  // ③ Amazon（キーワード → URL）
  rules.push(
    ...kw.map(({ keyword, url }) => ({
      regexp: new RegExp(esc(keyword), 'gi'),
      href:   url
    }))
  );

  return rules;
}

// ---------- 本体：HTML にアフィリンクを注入 ----------
export async function addAffiliateLinks (html) {
  const rules = await buildRules();

  /* (1) 既存 <a> を“避難”してトークン化 -------------- */
  const anchors = [];
  const TOKEN   = '%%ANCHOR%%';

  const tokenised = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, m => {
    anchors.push(m);
    return TOKEN;
  });

  /* (2) テキスト部だけルールを順番に適用 -------------- */
  let modified = tokenised;
  for (const { regexp, href } of rules) {
    modified = modified.replace(regexp, match =>
      `<a href="${href}" target="_blank" rel="nofollow noopener">${match}</a>`
    );
  }

  /* (3) トークンを元の <a> に戻して完了 -------------- */
  let i = 0;
  return modified.replace(new RegExp(TOKEN, 'g'), () => anchors[i++]);
}

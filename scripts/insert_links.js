import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('data');

// ---------- JSON を読み込んで優先順位付きのルールを作成 ----------
async function buildRules () {
  const prod   = JSON.parse(await fs.readFile(path.join(root, 'product_map.json')));
  const coll   = JSON.parse(await fs.readFile(path.join(root, 'collection_map.json')));
  const kwfile = JSON.parse(await fs.readFile(path.join(root, 'keyword_map.json')));

  const rules = [];

  // ①商品
  rules.push(
    ...prod.map(({ title, slug }) => ({
      regexp: new RegExp(title, 'g'),
      href:   `https://shop.sassamahha.me/products/${slug}`
    }))
  );

  // ②コレクション
  rules.push(
    ...coll.map(({ title, slug }) => ({
      regexp: new RegExp(title, 'g'),
      href:   `https://shop.sassamahha.me/collections/${slug}`
    }))
  );

  // ③Amazon
  rules.push(
    ...kwfile.map(({ keyword, url }) => ({
      regexp: new RegExp(keyword, 'g'),
      href:   url
    }))
  );

  return rules;
}

// ---------- 本体：HTML 文字列にリンクを埋め込む ----------
export async function addAffiliateLinks (html) {
  const rules = await buildRules();
  let out = html;

  for (const { regexp, href } of rules) {
    out = out.replace(regexp, m =>
      `<a href="${href}" target="_blank" rel="nofollow noopener">${m}</a>`
    );
  }
  return out;
}

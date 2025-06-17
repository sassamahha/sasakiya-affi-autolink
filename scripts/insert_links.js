// scripts/insert_links.js
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import cheerio from 'cheerio';

// --- データ読み込み ---
const P = JSON.parse(fs.readFileSync('data/product_map.json', 'utf8'));
const C = JSON.parse(fs.readFileSync('data/collection_map.json', 'utf8'));
const K = JSON.parse(fs.readFileSync('data/keyword_map.json', 'utf8'));
K.sort((a, b) => b.keyword.length - a.keyword.length);        // 長い語優先

// 正規化：全角英数→半角, カタカナ→ひらがな を最低限実装
const normalize = (s) => s
  .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c)=>String.fromCharCode(c.charCodeAt(0)-0xFEE0))
  .replace(/[\u30A1-\u30F6]/g, c=>String.fromCharCode(c.charCodeAt(0)-0x60))
  .toLowerCase();

const changed = execSync('git diff --name-only HEAD~1').toString().trim().split('\n')
  .filter(f => /\.(mdx?|html)$/.test(f));

for (const file of changed) {
  const ext = path.extname(file);
  let modified = false;

  if (ext === '.md' || ext === '.mdx') {
    const orig = fs.readFileSync(file, 'utf8');
    const tree = unified().use(remarkParse).parse(orig);

    visit(tree, 'text', node => {
      // 親がリンクなら対象外
      if (node?.position?.start && node?.position?.end && node.data?.hName === 'a') return;

      let txt = node.value;
      const nTxt = normalize(txt);

      // ①商品
      const p = P.find(o => normalize(o.title) === nTxt);
      if (p) {
        node.type = 'link';
        node.url = `https://shop.sassamahha.me/products/${p.handle}`;
        node.children = [{ type:'text', value: txt }];
        modified = true;
        return;
      }
      // ①コレクション
      const c = C.find(o => normalize(o.title) === nTxt);
      if (c) {
        node.type = 'link';
        node.url = `https://shop.sassamahha.me/collections/${c.slug}`;
        node.children = [{ type:'text', value: txt }];
        modified = true;
        return;
      }
      // ②Amazon 部分一致
      for (const kw of K) {
        if (txt.includes(kw.keyword)) {
          node.value = txt.replace(
            kw.keyword,
            `[${kw.keyword}](${kw.url})`
          );
          modified = true;
          break;
        }
      }
    });

    if (modified) {
      const out = unified().use(remarkStringify).stringify(tree);
      fs.writeFileSync(file, out);
    }
  }

  if (ext === '.html') {
    const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
    $('body').find('*').contents().filter((i, el)=>el.type==='text').each((i,el)=>{
      if (el.parent && el.parent.tagName==='a') return;      // 既リンク
      let txt = $(el).text();
      const nTxt = normalize(txt);

      // 完全一致 → 商品 / コレクション
      const p = P.find(o=>normalize(o.title)===nTxt);
      if (p) {
        $(el).replaceWith(`<a href="https://shop.sassamahha.me/products/${p.handle}">${txt}</a>`); modified=true; return;
      }
      const c = C.find(o=>normalize(o.title)===nTxt);
      if (c) {
        $(el).replaceWith(`<a href="https://shop.sassamahha.me/collections/${c.slug}">${txt}</a>`); modified=true; return;
      }
      // 部分一致 → Amazon
      for (const kw of K) {
        if (txt.includes(kw.keyword)) {
          $(el).replaceWith(txt.replace(
            kw.keyword,
            `<a href="${kw.url}">${kw.keyword}</a>`
          ));
          modified = true; break;
        }
      }
    });
    if (modified) fs.writeFileSync(file, $.html());
  }
}

process.exit(0);

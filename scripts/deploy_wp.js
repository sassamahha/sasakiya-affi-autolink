// scripts/deploy_wp.js
import { addAffiliateLinks } from './insert_links.js';

const { WP_BASE_URL, WP_USER, WP_APP_PW } = process.env;
if (!WP_BASE_URL || !WP_USER || !WP_APP_PW) {
  console.error('❌ 必須環境変数が足りません'); process.exit(1);
}

const auth = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PW}`).toString('base64');

const wpFetch = (url, opt = {}) =>
  fetch(`${WP_BASE_URL}/wp-json${url}`, {
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    ...opt
  }).then(async r => {
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`${r.status} ${r.statusText}: ${txt}`);
    }
    return r;
  });

/* ──────────────────────────────────────────────
 * 1) 全記事の slug → id マップを作る
 *    X-WP-TotalPages ヘッダでページネートを制御
 * ────────────────────────────────────────────── */
async function fetchAllPosts () {
  const map = new Map();
  const per = 100;
  let page = 1;
  while (true) {
    const res  = await wpFetch(`/wp/v2/posts?per_page=${per}&page=${page}`);
    const json = await res.json();
    json.forEach(p => map.set(p.slug, { id: p.id, html: p.content.rendered }));

    const total = Number(res.headers.get('x-wp-totalpages')) || 1;
    if (page >= total) break;
    page++;
  }
  return map;
}

/* ──────────────────────────────────────────────
 * 2) 各記事を置換して差分があれば PUT
 * ────────────────────────────────────────────── */
(async () => {
  const posts = await fetchAllPosts();
  console.log(`📝 fetched ${posts.size} posts`);

  let updated = 0;
  for (const { id, html } of posts.values()) {
    const replaced = addAffiliateLinks(html);
    if (replaced === html) continue;          // 変化なし

    await wpFetch(`/wp/v2/posts/${id}`, {
      method: 'PUT',
      body:   JSON.stringify({ content: replaced })
    });
    console.log(`  ✔ updated id=${id}`);
    updated++;
  }

  console.log(`🚀 finished. modified ${updated} / ${posts.size} posts`);
})().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});

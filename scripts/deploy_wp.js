// scripts/deploy_wp.js
// --------------------------------------------------
// WP REST API で “同 slug の記事があれば更新、なければ新規投稿”
// --------------------------------------------------
const {
  WP_BASE_URL,
  WP_USER,
  WP_APP_PW
} = process.env;

if (!WP_BASE_URL || !WP_USER || !WP_APP_PW) {
  console.error('❌ WP 環境変数が足りません');
  process.exit(1);
}

const authHeader = 'Basic ' +
  Buffer.from(`${WP_USER}:${WP_APP_PW}`).toString('base64');

async function wpFetch (path, init = {}) {
  const res = await fetch(`${WP_BASE_URL}/wp-json${path}`, {
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    ...init
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`WP API ${res.status}: ${txt}`);
  }
  return res;
}

// ─────────────────────────────
// ❶ まず全記事を slug ⇄ id で取得
// ─────────────────────────────
async function fetchAllPosts () {
  const perPage = 100;
  let page = 1;
  const map = new Map();         // slug → id

  while (true) {
    const res  = await wpFetch(`/wp/v2/posts?per_page=${perPage}&page=${page}`);
    const json = await res.json();
    json.forEach(p => map.set(p.slug, p.id));

    // ← ここ！ 公式ヘッダ X-WP-TotalPages で終了判定
    const totalPages = Number(res.headers.get('x-wp-totalpages') || 1);
    if (page >= totalPages) break;
    page++;
  }
  return map;
}

// ─────────────────────────────
// ❷ ここでは例として 1 本だけデプロイ
//    実際は MD → HTML 変換など行ってください
// ─────────────────────────────
(async () => {
  const slug = 'sample-slug';
  const body = {
    title:   'サンプル投稿',
    slug,
    status:  'publish',
    content: 'Hello WordPress from GitHub Actions!'
  };

  const postMap = await fetchAllPosts();
  if (postMap.has(slug)) {
    // 更新
    const id = postMap.get(slug);
    await wpFetch(`/wp/v2/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    console.log(`PUT success → ${WP_BASE_URL}/${id}/`);
  } else {
    // 新規
    const res = await wpFetch('/wp/v2/posts', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const json = await res.json();
    console.log(`POST success → ${json.link}`);
  }
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});

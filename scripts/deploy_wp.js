import { addAffiliateLinks } from './insert_links.js';

const { WP_BASE_URL, WP_USER, WP_APP_PW } = process.env;
if (!WP_BASE_URL || !WP_USER || !WP_APP_PW) {
  console.error('❌ WP_BASE_URL / USER / APP_PW が未設定'); process.exit(1);
}

const auth = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PW}`).toString('base64');
const wp   = (url, opt = {}) => fetch(
  `${WP_BASE_URL}/wp-json${url}`,
  { headers: { Authorization: auth, 'Content-Type': 'application/json' }, ...opt }
).then(async r => {
  if (!r.ok) throw new Error(`${r.statusText} ${await r.text()}`);
  return r;
});

async function* fetchAllPosts () {
  const per = 100;
  let page  = 1;
  while (true) {
    const r  = await wp(`/wp/v2/posts?per_page=${per}&page=${page}`);
    const js = await r.json();
    for (const p of js) yield p;
    if (page++ >= +(r.headers.get('x-wp-totalpages') || 1)) break;
  }
}

(async () => {
  let touched = 0, scanned = 0;

  for await (const post of fetchAllPosts()) {
    scanned++;
    const replaced = await addAffiliateLinks(post.content.rendered);
    if (replaced === post.content.rendered) continue;

    await wp(`/wp/v2/posts/${post.id}`, {
      method: 'PUT',
      body:   JSON.stringify({ content: replaced })
    });
    console.log(`✔ updated post#${post.id}`);
    touched++;
  }

  console.log(`🏁 done. modified ${touched}/${scanned} posts`);
})().catch(e => { console.error(e); process.exit(1); });

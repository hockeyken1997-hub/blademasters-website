// netlify/functions/blog.js
//
// Server-rendered blog index page — same on-demand caching approach
// as post.js. Lists every published post with a real <a href> to its
// /p/slug page, so Google sees actual links in actual HTML on first
// crawl, instead of an empty shell waiting on a JavaScript fetch.

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAI-U6atVom3DwfUWIhLoRU1G9aHnaaU1Y",
  projectId: "blade-masters",
};

const MAX_AGE_SECONDS = 60 * 30; // 30 minutes, same reasoning as post.js

exports.handler = async () => {
  let posts;
  try {
    posts = await fetchPublishedPosts();
  } catch (err) {
    console.error("blog function error:", err);
    posts = [];
  }

  const html = renderBlogHtml(posts);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": `public, max-age=${MAX_AGE_SECONDS}, s-maxage=${MAX_AGE_SECONDS}`,
    },
    body: html,
  };
};

async function fetchPublishedPosts() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/blogPosts?key=${FIREBASE_CONFIG.apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore fetch failed: ${res.status}`);
  const json = await res.json();
  const docs = json.documents || [];

  return docs
    .map((doc) => {
      const data = firestoreDocToPlainObject(doc);
      const slug = doc.name.split("/").pop();
      return { ...data, slug };
    })
    .filter((post) => post.status === "published")
    .sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    });
}

function firestoreDocToPlainObject(doc) {
  if (!doc || !doc.fields) return null;
  const out = {};
  for (const [key, val] of Object.entries(doc.fields)) {
    out[key] = firestoreValueToPlain(val);
  }
  return out;
}

function firestoreValueToPlain(val) {
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.nullValue !== undefined) return null;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.arrayValue !== undefined) {
    return (val.arrayValue.values || []).map(firestoreValueToPlain);
  }
  if (val.mapValue !== undefined) {
    const out = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      out[k] = firestoreValueToPlain(v);
    }
    return out;
  }
  return null;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstTextExcerpt(blocks) {
  const textBlock = (blocks || []).find((b) => b.type === "text" && b.text);
  if (!textBlock) return "";
  const text = textBlock.text;
  return text.length > 140 ? text.slice(0, 140).trim() + "…" : text;
}

function renderPostCard(post) {
  const excerpt = post.metaDescription || firstTextExcerpt(post.blocks);
  return `<a href="/p/${escapeHtml(post.slug)}" class="post-card">
    <div class="post-card-img">${escapeHtml(post.emoji || "📝")}</div>
    <div class="post-card-body">
      <div class="post-card-season">${escapeHtml(post.seasonBadge || "")}</div>
      <div class="post-card-title">${escapeHtml(post.title || "Untitled")}</div>
      <p class="post-card-excerpt">${escapeHtml(excerpt)}</p>
      <div class="post-card-read">Read more →</div>
    </div>
  </a>`;
}

function renderBlogHtml(posts) {
  const postsHtml = posts.length
    ? posts.map(renderPostCard).join("")
    : `<p style="grid-column: 1 / -1; text-align:center; color: var(--muted); padding: 30px 0;">No posts published yet. Check back soon.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lawn Care & Snow Removal Blog | Blade Masters — Macomb County, MI</title>
  <meta name="description" content="Seasonal lawn care, snow removal, and landscaping tips for homeowners in Shelby Township, Troy, Utica, Sterling Heights, Warren, and Macomb County, Michigan." />
  <meta name="geo.region" content="US-MI" />
  <meta name="geo.placename" content="Shelby Township, Michigan" />
  <meta property="og:title" content="Lawn Care & Snow Removal Blog | Blade Masters" />
  <meta property="og:description" content="Seasonal lawn care and snow removal tips for Macomb County, Michigan homeowners." />
  <meta property="og:type" content="website" />
  <link rel="canonical" href="https://blademastersinc.com/blog.html" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Blade Masters Lawn Care Blog",
    description: "Seasonal lawn care, snow removal, and landscaping advice for Macomb County, Michigan homeowners.",
    publisher: {
      "@type": "LocalBusiness",
      name: "Blade Masters",
      telephone: "+15864950348",
      areaServed: ["Shelby Township", "Troy", "Utica", "Sterling Heights", "Warren", "Macomb County"],
    },
  })}</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --navy: #11557c; --navy-dark: #0c3f5e; --navy-light: #e6f0f7; --teal: #12828d;
      --accent: #a6d066; --accent-dark: #7aab3a; --white: #ffffff; --off-white: #f6f8fa;
      --text: #1a2530; --muted: #4a5a6a; --border: #ccd8e0;
    }
    html { scroll-behavior: smooth; }
    body { font-family: 'Outfit', sans-serif; background: var(--white); color: var(--text); overflow-x: hidden; }
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 200;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 clamp(16px, 4vw, 56px); height: 68px;
      background: rgba(12, 63, 94, 0.98); backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(166,208,102,0.15);
    }
    .nav-left { display: flex; align-items: center; gap: 32px; }
    .nav-brand { text-decoration: none; display: flex; align-items: center; }
    .nav-brand img { height: 36px; object-fit: contain; }
    .nav-phone { display: none; align-items: center; gap: 7px; color: rgba(255,255,255,0.75); font-size: 13px; font-weight: 600; text-decoration: none; }
    .nav-phone:hover { color: var(--accent); }
    @media(min-width:640px) { .nav-phone { display: flex; } }
    .nav-cta { background: var(--accent); color: var(--navy-dark); font-weight: 800; font-size: 13px; padding: 10px 22px; border-radius: 8px; border: none; cursor: pointer; text-decoration: none; transition: all 0.15s; letter-spacing: 0.3px; white-space: nowrap; }
    .nav-cta:hover { background: #b8e070; transform: translateY(-1px); }
    .blog-header { background: var(--navy-dark); padding: 140px clamp(20px, 5vw, 80px) 64px; text-align: center; position: relative; overflow: hidden; }
    .blog-header-inner { position: relative; z-index: 2; max-width: 720px; margin: 0 auto; }
    .blog-label { display: inline-flex; align-items: center; gap: 6px; background: rgba(166,208,102,0.12); border: 1px solid rgba(166,208,102,0.35); color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 16px; border-radius: 100px; margin-bottom: 20px; }
    .blog-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(42px, 7vw, 68px); line-height: 1; color: var(--white); letter-spacing: 1px; margin-bottom: 16px; }
    .blog-title span { color: var(--accent); }
    .blog-sub { font-size: clamp(14px, 1.6vw, 17px); color: rgba(255,255,255,0.68); line-height: 1.65; }
    .blog-main { padding: 64px clamp(20px, 5vw, 80px) 100px; max-width: 1100px; margin: 0 auto; }
    .post-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 28px; }
    .post-card { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; text-decoration: none; color: var(--text); transition: transform 0.18s ease, box-shadow 0.18s ease; background: var(--white); }
    .post-card:hover { transform: translateY(-4px); box-shadow: 0 14px 32px rgba(17,85,124,0.14); }
    .post-card-img { height: 160px; display: flex; align-items: center; justify-content: center; font-size: 48px; background: linear-gradient(135deg, var(--navy), var(--teal)); }
    .post-card-body { padding: 22px 22px 26px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
    .post-card-season { font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--accent-dark); }
    .post-card-title { font-size: 19px; font-weight: 800; line-height: 1.3; color: var(--navy-dark); }
    .post-card-excerpt { font-size: 14px; color: var(--muted); line-height: 1.55; flex: 1; }
    .post-card-read { font-size: 13px; font-weight: 700; color: var(--navy); margin-top: 4px; }
    .blog-cta { margin-top: 56px; background: var(--off-white); border: 1px solid var(--border); border-radius: 16px; padding: 40px clamp(20px, 4vw, 48px); text-align: center; }
    .blog-cta h2 { font-family: 'Bebas Neue', sans-serif; font-size: 30px; color: var(--navy-dark); margin-bottom: 10px; letter-spacing: 0.5px; }
    .blog-cta p { color: var(--muted); font-size: 15px; margin-bottom: 22px; }
    .blog-cta-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .btn-primary { background: var(--accent); color: var(--navy-dark); font-weight: 800; font-size: 14px; padding: 13px 28px; border-radius: 9px; text-decoration: none; transition: all 0.15s; }
    .btn-primary:hover { background: #b8e070; transform: translateY(-1px); }
    .btn-outline { border: 1.5px solid var(--navy); color: var(--navy); font-weight: 800; font-size: 14px; padding: 13px 28px; border-radius: 9px; text-decoration: none; transition: all 0.15s; }
    .btn-outline:hover { background: var(--navy-light); }
    footer { background: var(--navy-dark); padding: clamp(40px,6vw,64px) clamp(20px,5vw,60px) 24px; }
    .footer-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.2fr; gap: 36px; max-width: 1100px; margin: 0 auto 36px; }
    @media(max-width:800px) { .footer-grid { grid-template-columns: 1fr 1fr; } }
    @media(max-width:500px) { .footer-grid { grid-template-columns: 1fr; } }
    .footer-brand-col img { height: 48px; object-fit: contain; margin-bottom: 14px; display: block; }
    .footer-tagline { font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.65; max-width: 220px; }
    .footer-col-title { font-weight: 800; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent); margin-bottom: 14px; }
    .footer-links { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .footer-links a { color: rgba(255,255,255,0.55); font-size: 13px; text-decoration: none; transition: color 0.15s; }
    .footer-links a:hover { color: var(--accent); }
    .footer-contact-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
    .footer-contact-item span { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
    .footer-contact-item a, .footer-contact-item p { color: rgba(255,255,255,0.6); font-size: 13px; text-decoration: none; line-height: 1.5; }
    .footer-contact-item a:hover { color: var(--accent); }
    .footer-bottom { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; max-width: 1100px; margin: 0 auto; }
    .footer-copy { font-size: 12px; color: rgba(255,255,255,0.3); }
    .mobile-cta-bar { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 190; background: var(--navy-dark); border-top: 1px solid rgba(166,208,102,0.2); padding: 10px 16px; gap: 10px; }
    .mobile-cta-bar a { flex: 1; text-align: center; padding: 12px; border-radius: 9px; font-weight: 800; font-size: 13px; text-decoration: none; transition: all 0.15s; }
    .mobile-cta-call { background: rgba(255,255,255,0.1); color: var(--white); border: 1px solid rgba(255,255,255,0.2); }
    .mobile-cta-quote { background: var(--accent); color: var(--navy-dark); }
    @media(max-width:767px) { .mobile-cta-bar { display: flex; } body { padding-bottom: 72px; } }
  </style>
</head>
<body>
  <nav>
    <div class="nav-left">
      <a href="/index.html" class="nav-brand"><img src="/logo.png" alt="Blade Masters" /></a>
      <a href="tel:+15864950348" class="nav-phone"><span>📞</span> (586) 495-0348</a>
    </div>
    <div class="nav-right">
      <a href="/index.html#request" class="nav-cta">Get a Free Quote</a>
    </div>
  </nav>

  <header class="blog-header">
    <div class="blog-header-inner">
      <div class="blog-label">The Yard Notes</div>
      <h1 class="blog-title">Seasonal Lawn Care <span>Tips</span></h1>
      <p class="blog-sub">Practical, no-nonsense advice for keeping your Macomb County yard looking sharp all year — from the team that mows it.</p>
    </div>
  </header>

  <main class="blog-main">
    <div class="post-grid">${postsHtml}</div>

    <div class="blog-cta">
      <h2>Want it handled for you?</h2>
      <p>Blade Masters covers Shelby Township, Troy, Utica, Sterling Heights, Warren &amp; Macomb County — all season, every season.</p>
      <div class="blog-cta-actions">
        <a href="/index.html#request" class="btn-primary">📋 Get a Free Quote</a>
        <a href="tel:+15864950348" class="btn-outline">📞 Call Us Now</a>
      </div>
    </div>
  </main>

  <div class="mobile-cta-bar">
    <a href="tel:+15864950348" class="mobile-cta-call">📞 Call</a>
    <a href="/index.html#request" class="mobile-cta-quote">📋 Free Quote</a>
  </div>

  <footer>
    <div class="footer-grid">
      <div class="footer-brand-col">
        <img src="/logo.png" alt="Blade Masters" />
        <p class="footer-tagline">Lawn care, snow removal & landscaping in Shelby Township, Troy, Utica, Sterling Heights, Warren & Macomb County, MI.</p>
      </div>
      <div>
        <div class="footer-col-title">Services</div>
        <ul class="footer-links">
          <li><a href="/index.html#services">Lawn Mowing</a></li>
          <li><a href="/index.html#services">Snow Removal</a></li>
          <li><a href="/index.html#services">Bush & Shrub Trimming</a></li>
          <li><a href="/index.html#services">Leaf Cleanup</a></li>
        </ul>
      </div>
      <div>
        <div class="footer-col-title">Company</div>
        <ul class="footer-links">
          <li><a href="/index.html#why">Why Blade Masters</a></li>
          <li><a href="/index.html#how">How It Works</a></li>
          <li><a href="/index.html#area">Service Area</a></li>
          <li><a href="/blog.html">Blog</a></li>
        </ul>
      </div>
      <div>
        <div class="footer-col-title">Contact Us</div>
        <div class="footer-contact-item"><span>📞</span><a href="tel:+15864950348">(586) 495-0348</a></div>
        <div class="footer-contact-item"><span>📍</span><p>Shelby Township · Troy · Utica<br>Sterling Heights · Warren · Macomb County</p></div>
        <div class="footer-contact-item"><span>🕐</span><p>Mon–Sat: 7am – 7pm<br>Sun: Emergency only</p></div>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="footer-copy">© 2025 Blade Masters. All rights reserved.</span>
      <a href="/index.html#request" style="font-size:12px;color:var(--accent);text-decoration:none;font-weight:700;">Get a Free Quote →</a>
    </div>
  </footer>
</body>
</html>`;
}

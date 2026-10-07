import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { assetUrl, shareUrl } from "@/lib/config";
import { useI18n } from "@/context/I18nContext";
import { useSeo } from "@/lib/seo";
import VideoCard from "@/components/videos/VideoCard";

// Plain-text body: blank line = paragraph, "## " = heading, lines starting "- " = bullet list.
// Rendered as React elements (never as HTML), so post content cannot inject markup.
export function Body({ text }) {
  return text.split(/\n{2,}/).map((block, i) => {
    const lines = block.split("\n");
    if (block.startsWith("## ")) return <h2 key={i} className="font-display text-3xl text-urbanex-navy mt-10 mb-2">{block.slice(3)}</h2>;
    if (lines.every(l => l.startsWith("- "))) {
      return <ul key={i} className="list-disc pl-6 my-4 space-y-1 text-urbanex-navy/80">{lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}</ul>;
    }
    return <p key={i} className="my-4 text-urbanex-navy/80 leading-relaxed whitespace-pre-line">{block}</p>;
  });
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const { t, lang } = useI18n();
  const [post, setPost] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { api.get(`/posts/${slug}`).then(r => setPost(r.data)).catch(() => setMissing(true)); }, [slug]);

  useSeo(post ? {
    title: post.title, description: post.excerpt || post.body.slice(0, 160), image: assetUrl(post.cover),
    jsonLd: {
      "@context": "https://schema.org", "@type": "Article", headline: post.title, datePublished: post.created_at,
      dateModified: post.updated_at, author: { "@type": "Person", name: post.author },
      publisher: { "@type": "Organization", name: "Urbanex Realty" }, ...(post.cover ? { image: assetUrl(post.cover) } : {}),
    },
  } : { title: "Guide" });

  if (missing) return <div className="max-w-3xl mx-auto px-6 py-24 text-urbanex-navy/60">Article not found. <Link to="/blog" className="underline">{t("blog.back")}</Link></div>;
  if (!post) return <div className="max-w-3xl mx-auto px-6 py-24 text-urbanex-navy/50">{t("common.loading")}</div>;

  const showBn = lang === "bn" && !!post.body_bn && !!post.title_bn;
  return (
    <article className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-urbanex-navy/60 hover:text-urbanex-navy mb-8"><ArrowLeft className="w-4 h-4"/> {t("blog.back")}</Link>
      <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold">{post.category.replace("-", " ")}</div>
      <h1 className="font-display text-4xl md:text-6xl text-urbanex-navy tracking-tight mt-3 leading-tight text-balance">{showBn ? post.title_bn : post.title}</h1>
      <div className="mt-4 text-sm text-urbanex-navy/50">{post.author} · {(post.created_at || "").slice(0, 10)}</div>
      {post.cover && <img src={assetUrl(post.cover)} alt="" className="mt-8 rounded-2xl w-full aspect-video object-cover"/>}
      <div className="mt-8" lang={showBn ? "bn" : "en"}><Body text={showBn ? post.body_bn : post.body}/></div>
      {post.videos?.length > 0 && (
        <section className="mt-14" data-testid="post-videos">
          <h2 className="font-display text-3xl text-urbanex-navy mb-6">{t("blog.videosTitle")}</h2>
          <div className="grid sm:grid-cols-2 gap-6">{post.videos.map(v => <VideoCard key={v.video_id} video={v}/>)}</div>
        </section>
      )}
      {post.sources?.length > 0 && (
        <section className="mt-12" data-testid="post-sources">
          <h2 className="text-xs tracking-[0.28em] uppercase text-urbanex-gold mb-3">{t("blog.sources")}</h2>
          <ul className="space-y-1.5 text-sm">
            {post.sources.filter(s => /^https?:\/\//.test(s.url)).map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-urbanex-navy/70 underline hover:text-urbanex-gold">{s.title}</a></li>)}
          </ul>
        </section>
      )}
      {post.generated && <p className="mt-10 text-xs text-urbanex-navy/50 border-l-2 border-urbanex-gold/50 pl-4">{t("blog.aiNote")}</p>}
      <a href={`https://wa.me/?text=${encodeURIComponent(`${post.title}\n${shareUrl("blog", post.slug)}`)}`} target="_blank" rel="noreferrer"
        className="mt-10 inline-block text-sm border border-urbanex-navy/15 hover:border-urbanex-gold rounded-full px-5 py-2">{t("share.whatsapp")}</a>
    </article>
  );
}

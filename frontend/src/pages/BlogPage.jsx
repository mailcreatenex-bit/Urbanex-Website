import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { assetUrl } from "@/lib/config";
import { useI18n } from "@/context/I18nContext";
import { useSeo } from "@/lib/seo";

export default function BlogPage() {
  const { t } = useI18n();
  const [posts, setPosts] = useState(null);
  useSeo({ title: "Area guides & buying advice", description: "Burdwan neighbourhood guides, paperwork checklists and smart-buying advice from Urbanex Realty." });
  useEffect(() => { api.get("/posts").then(r => setPosts(r.data)).catch(() => setPosts([])); }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <h1 className="font-display text-5xl md:text-6xl text-urbanex-navy tracking-tight max-w-3xl text-balance">{t("blog.title")}</h1>
      <p className="mt-6 text-urbanex-navy/70 max-w-xl">{t("blog.sub")}</p>
      {posts && posts.length === 0 && <p className="mt-16 text-urbanex-navy/50">{t("blog.empty")}</p>}
      <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {(posts || []).map(p => (
          <Link key={p.id} to={`/blog/${p.slug}`} className="group bg-white rounded-2xl overflow-hidden border border-urbanex-navy/5 hover:border-urbanex-gold/40 transition-colors">
            {p.cover && <img src={assetUrl(p.cover)} alt="" loading="lazy" className="w-full aspect-video object-cover"/>}
            <div className="p-6">
              <div className="text-[10px] tracking-[0.24em] uppercase text-urbanex-gold">{p.category.replace("-", " ")}</div>
              <h2 className="mt-2 font-display text-2xl text-urbanex-navy group-hover:text-urbanex-gold transition-colors">{p.title}</h2>
              <p className="mt-2 text-sm text-urbanex-navy/65 line-clamp-3">{p.excerpt}</p>
              <div className="mt-4 text-xs text-urbanex-navy/40">{(p.created_at || "").slice(0, 10)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

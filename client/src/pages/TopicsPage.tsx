import { Link, useLocation } from "wouter";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import { TOPIC_HUBS } from "@/lib/seoKeywords";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";

export default function TopicsPage() {
  const [, setLocation] = useLocation();

  return (
    <Layout>
      <SEO
        title="Bhagavad Gita Topics for Daily Life"
        description="Explore Bhagavad Gita teachings by life-intent topics: anxiety, decision making, focus, karma yoga, devotion, and spiritual wisdom."
        path="/topics"
        type="website"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: TOPIC_HUBS.map((hub, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: hub.title,
            url: `https://gita.gurukula.com/topics/${hub.slug}`,
          })),
        }}
      />

      <div className="px-4 lg:px-6 py-8">
        <h1 className="font-display text-3xl lg:text-4xl text-red-950 mb-2">Bhagavad Gita by Life Topics</h1>
        <p className="text-foreground/80 max-w-3xl">
          Browse practical Gita guidance mapped to everyday needs such as stress relief, focus, ethical
          decision making, and spiritual growth.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {TOPIC_HUBS.map((hub) => (
            <Link
              key={hub.slug}
              href={`/topics/${hub.slug}`}
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() => setLocation(`/topics/${hub.slug}`));
              }}
            >
              <article className="rounded-xl border border-orange-200 bg-white p-5 hover:border-orange-300 hover:shadow-md transition-all h-full">
                <h2 className="font-display text-xl text-red-950 mb-2">{hub.title}</h2>
                <p className="text-sm text-foreground/80 mb-3">{hub.shortDescription}</p>
                <div className="flex flex-wrap gap-1.5">
                  {hub.primaryKeywords.slice(0, 3).map((keyword) => (
                    <span key={keyword} className="text-xs bg-orange-50 border border-orange-200 text-orange-700 rounded-full px-2 py-0.5">
                      {keyword}
                    </span>
                  ))}
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}


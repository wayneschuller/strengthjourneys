import Link from "next/link";
import { devLog } from "@/lib/processing-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ArrowRight, Newspaper } from "lucide-react";

export function ArticleSummaryCard({ article }) {
  return (
    <Card className="">
      <CardHeader>
        <CardTitle>
          <Link href={`/articles/${article.slug}`} className="hover:underline">
            {article.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* <p className="text-sm text-gray-500"> Published on {new Date(article.publishedAt).toLocaleDateString()} </p> */}
        {false && article.categories && article.categories.length > 0 && (
          <p className="mt-2 text-sm text-gray-500">
            Categories: {article.categories.map((cat) => cat.title).join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function RelatedArticles({ articles }) {
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Newspaper className="mr-2" />
          Related Articles
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {articles.map((article) => (
            <li key={article.slug} className="group">
              <Link
                href={`/articles/${article.slug}`}
                className="flex items-center rounded-md p-2 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <FileText
                  className="mr-3 text-gray-400 group-hover:text-primary"
                  size={20}
                />
                <span className="flex-grow text-sm group-hover:text-primary">
                  {article.title}
                </span>
                <ArrowRight
                  className="ml-2 text-gray-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary"
                  size={16}
                />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

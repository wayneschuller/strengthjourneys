import Link from "next/link";
import { devLog } from "@/lib/processing-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

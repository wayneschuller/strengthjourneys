import Link from "next/link";
import { devLog } from "@/lib/processing-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, ArrowRight, Newspaper } from "lucide-react";
import { format } from "date-fns";
import Image from "next/image";
import { urlFor } from "@/lib/sanity-io.js";

export function ArticleSummaryCard({ article }) {
  devLog(article);

  return (
    <Link href={`/articles/${article.slug}`}>
      <Card className="group transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800">
        <CardHeader className="flex flex-row gap-4">
          <div className="min-w-56 flex-1">
            <CardTitle className="text-balance group-hover:underline">
              {article.title}
            </CardTitle>
            <CardDescription>
              {format(new Date(article.publishedAt), "MMMM d, yyyy")}
            </CardDescription>
            {/* <p className="text-sm text-gray-500"> Published on {new Date(article.publishedAt).toLocaleDateString()} </p> */}
            {article.description && (
              <div className="mt-2 text-sm">{article.description}</div>
            )}
          </div>
          <SquareImage sanityImage={article.mainImage} />
        </CardHeader>
        <CardContent>
          {false && article.categories && article.categories.length > 0 && (
            <p className="mt-2 text-sm text-gray-500">
              Categories:{" "}
              {article.categories.map((cat) => cat.title).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export function RelatedArticles({ articles }) {
  // devLog(articles);
  if (!articles) return null;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Newspaper className="mr-2" />
          Related Articles
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 items-center justify-center gap-4 md:grid-cols-3 xl:grid-cols-4">
          {articles.map((article) => (
            <div key={article.slug} className="group h-full rounded-lg border">
              <Link
                href={`/articles/${article.slug}`}
                className="flex items-center rounded-md p-2 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <FileText className="mr-3 w-20 text-gray-400 group-hover:text-primary" />
                <span className="mr-3 flex-grow text-balance group-hover:text-primary">
                  {article.title}
                  <div className="text-muted-foreground">
                    {format(new Date(article.publishedAt), "MMMM d, yyyy")}
                  </div>
                </span>
                <SquareImage sanityImage={article.mainImage} />
                {/* <ArrowRight className="ml-2 text-gray-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" size={16} /> */}
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const SquareImage = ({ sanityImage }) => {
  if (!sanityImage) return null;

  let imageUrl = urlFor(sanityImage)
    .width(150)
    .height(150)
    .fit("crop")
    .quality(80)
    .url();

  if (!imageUrl) return null;

  return (
    <div className="relative aspect-square transform justify-center overflow-hidden rounded-lg transition-transform duration-300 group-hover:scale-110">
      <Image
        src={imageUrl}
        alt="Banner"
        width={150}
        height={150}
        // fill
        // style={{ objectFit: "cover" }}
        className="h-full w-full object-cover"

        // sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw"
      />
    </div>
  );
};

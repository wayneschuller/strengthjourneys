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
  return (
    <Card className="">
      <CardHeader className="flex flex-row gap-4">
        <div className="flex-1">
          <CardTitle>
            <Link
              href={`/articles/${article.slug}`}
              className="text-balance hover:underline"
            >
              {article.title}
            </Link>
          </CardTitle>
          <CardDescription>
            {format(new Date(article.publishedAt), "MMMM d, yyyy")}
          </CardDescription>
        </div>
        <SquareImage sanityImage={article.mainImage} />
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
  devLog(articles);
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {articles.map((article) => (
            <div key={article.slug} className="group rounded-lg border">
              <Link
                href={`/articles/${article.slug}`}
                className="flex items-center rounded-md p-2 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <FileText
                  className="mr-3 text-gray-400 group-hover:text-primary"
                  size={20}
                />
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
  if (!sanityImage) return;

  let imageUrl = null;
  if (sanityImage) {
    imageUrl = urlFor(sanityImage).url();
    devLog(imageUrl);
  }

  if (!imageUrl) return null;

  return (
    <div className="relative h-20 w-20 overflow-hidden rounded-lg">
      {/* Adjust height as needed */}
      <Image
        src={imageUrl}
        alt="Banner"
        layout="fill" // This makes the image cover the container
        objectFit="cover" // Ensures the image covers the container
      />
    </div>
  );
};

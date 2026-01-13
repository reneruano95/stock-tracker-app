import { inngest } from "@/lib/inngest/client";
import { NEWS_SUMMARY_EMAIL_PROMPT } from "@/lib/inngest/prompts";
import { getWatchlistSymbols } from "@/lib/storage/file-storage";
import { getNews } from "@/lib/actions/finnhub.actions";
import { getFormattedTodayDate } from "@/lib/utils";

export const sendDailyNewsSummary = inngest.createFunction(
  { id: "daily-news-summary" },
  [{ event: "app/send.daily.news" }, { cron: "0 12 * * *" }],
  async ({ step }) => {
    // Step #1: Get watchlist symbols from file storage
    const symbols = await step.run(
      "get-watchlist-symbols",
      getWatchlistSymbols
    );

    // Step #2: Fetch news for watchlist (fallback to general news)
    const articles = await step.run("fetch-news", async () => {
      let news = await getNews(symbols);
      news = (news || []).slice(0, 6);

      // If no news for watchlist, get general news
      if (!news || news.length === 0) {
        news = await getNews();
        news = (news || []).slice(0, 6);
      }
      return news;
    });

    if (!articles || articles.length === 0) {
      return { success: false, message: "No news articles found" };
    }

    // Step #3: Summarize news via AI
    const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace(
      "{{newsData}}",
      JSON.stringify(articles, null, 2)
    );

    const response = await step.ai.infer("summarize-news", {
      model: step.ai.models.gemini({ model: "gemini-2.5-flash-lite" }),
      body: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const newsContent =
      (part && "text" in part ? part.text : null) || "No market news.";

    // Log the generated summary
    console.log("News summary generated:", "Date:", getFormattedTodayDate());
    console.log(newsContent);

    return {
      success: true,
      message: "Daily news summary generated successfully",
    };
  }
);

"use server";

import { getDateRange } from "@/lib/utils";
import { POPULAR_STOCK_SYMBOLS } from "@/lib/constants";
import { cache } from "react";

const POLYGON_BASE_URL = "https://api.polygon.io";
const POLYGON_API_KEY = process.env.POLYGON_API_KEY ?? "";

async function fetchJSON<T>(
  url: string,
  revalidateSeconds?: number
): Promise<T> {
  const options: RequestInit & { next?: { revalidate?: number } } =
    revalidateSeconds
      ? { cache: "force-cache", next: { revalidate: revalidateSeconds } }
      : { cache: "no-store" };

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fetch failed ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export { fetchJSON };

// Polygon News Response Types
interface PolygonNewsArticle {
  id: string;
  publisher: {
    name: string;
    homepage_url: string;
    logo_url?: string;
  };
  title: string;
  author?: string;
  published_utc: string;
  article_url: string;
  tickers?: string[];
  image_url?: string;
  description?: string;
  keywords?: string[];
}

interface PolygonNewsResponse {
  results: PolygonNewsArticle[];
  status: string;
  count: number;
  next_url?: string;
}

// Polygon Ticker Search Response Types
interface PolygonTicker {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange?: string;
  type?: string;
  active: boolean;
  currency_name?: string;
  cik?: string;
  composite_figi?: string;
  share_class_figi?: string;
  last_updated_utc?: string;
}

interface PolygonTickerSearchResponse {
  results: PolygonTicker[];
  status: string;
  count: number;
  next_url?: string;
}

// Polygon Ticker Details Response
interface PolygonTickerDetails {
  results: {
    ticker: string;
    name: string;
    market: string;
    locale: string;
    primary_exchange: string;
    type: string;
    active: boolean;
    currency_name: string;
    market_cap?: number;
    description?: string;
    homepage_url?: string;
    total_employees?: number;
    list_date?: string;
    branding?: {
      logo_url?: string;
      icon_url?: string;
    };
  };
  status: string;
}

// Polygon Snapshot Response
interface PolygonSnapshot {
  ticker: {
    ticker: string;
    todaysChange: number;
    todaysChangePerc: number;
    day: {
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
    };
    prevDay: {
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
    };
  };
  status: string;
}

// Convert Polygon article to app's MarketNewsArticle format
function formatPolygonArticle(
  article: PolygonNewsArticle,
  index: number
): MarketNewsArticle {
  const publishedDate = new Date(article.published_utc);
  return {
    id: parseInt(article.id) || index,
    headline: article.title,
    summary: article.description || "",
    source: article.publisher.name,
    url: article.article_url,
    datetime: Math.floor(publishedDate.getTime() / 1000),
    category: article.tickers?.[0] || "general",
    related: (article.tickers || []).join(","),
    image: article.image_url,
  };
}

function validatePolygonArticle(article: PolygonNewsArticle): boolean {
  return !!(article.title && article.article_url && article.publisher?.name);
}

export async function getNews(
  symbols?: string[]
): Promise<MarketNewsArticle[]> {
  try {
    if (!POLYGON_API_KEY) {
      throw new Error("POLYGON API key is not configured");
    }

    const cleanSymbols = (symbols || [])
      .map((s) => s?.trim().toUpperCase())
      .filter((s): s is string => Boolean(s));

    const maxArticles = 6;
    let url: string;

    if (cleanSymbols.length > 0) {
      // Fetch news for specific tickers
      const tickerParam = cleanSymbols.slice(0, 5).join(",");
      url = `${POLYGON_BASE_URL}/v2/reference/news?ticker=${tickerParam}&limit=${maxArticles}&apiKey=${POLYGON_API_KEY}`;
    } else {
      // Fetch general market news
      url = `${POLYGON_BASE_URL}/v2/reference/news?limit=${maxArticles}&apiKey=${POLYGON_API_KEY}`;
    }

    const data = await fetchJSON<PolygonNewsResponse>(url, 300);

    if (!data.results || data.results.length === 0) {
      // Fallback to general news if no results for symbols
      if (cleanSymbols.length > 0) {
        const fallbackUrl = `${POLYGON_BASE_URL}/v2/reference/news?limit=${maxArticles}&apiKey=${POLYGON_API_KEY}`;
        const fallbackData = await fetchJSON<PolygonNewsResponse>(
          fallbackUrl,
          300
        );
        return (fallbackData.results || [])
          .filter(validatePolygonArticle)
          .slice(0, maxArticles)
          .map((article, idx) => formatPolygonArticle(article, idx));
      }
      return [];
    }

    return data.results
      .filter(validatePolygonArticle)
      .slice(0, maxArticles)
      .map((article, idx) => formatPolygonArticle(article, idx));
  } catch (err) {
    console.error("getNews error:", err);
    throw new Error("Failed to fetch news");
  }
}

export const searchStocks = cache(
  async (query?: string): Promise<StockWithWatchlistStatus[]> => {
    try {
      if (!POLYGON_API_KEY) {
        console.error(
          "Error in stock search:",
          new Error("POLYGON API key is not configured")
        );
        return [];
      }

      const trimmed = typeof query === "string" ? query.trim() : "";

      let results: PolygonTicker[] = [];

      if (!trimmed) {
        // Fetch top 10 popular symbols' details
        const top = POPULAR_STOCK_SYMBOLS.slice(0, 10);
        const tickerDetails = await Promise.all(
          top.map(async (sym) => {
            try {
              const url = `${POLYGON_BASE_URL}/v3/reference/tickers/${encodeURIComponent(
                sym
              )}?apiKey=${POLYGON_API_KEY}`;
              const details = await fetchJSON<PolygonTickerDetails>(url, 3600);
              if (details.results) {
                return {
                  ticker: details.results.ticker,
                  name: details.results.name,
                  market: details.results.market,
                  locale: details.results.locale,
                  primary_exchange: details.results.primary_exchange,
                  type: details.results.type,
                  active: details.results.active,
                } as PolygonTicker;
              }
              return null;
            } catch (e) {
              console.error("Error fetching ticker details for", sym, e);
              return null;
            }
          })
        );

        results = tickerDetails.filter((t): t is PolygonTicker => t !== null);
      } else {
        // Search for tickers matching query
        const url = `${POLYGON_BASE_URL}/v3/reference/tickers?search=${encodeURIComponent(
          trimmed
        )}&active=true&market=stocks&limit=15&apiKey=${POLYGON_API_KEY}`;
        const data = await fetchJSON<PolygonTickerSearchResponse>(url, 1800);
        results = Array.isArray(data?.results) ? data.results : [];
      }

      const mapped: StockWithWatchlistStatus[] = results
        .map((ticker) => {
          const item: StockWithWatchlistStatus = {
            symbol: ticker.ticker.toUpperCase(),
            name: ticker.name || ticker.ticker,
            exchange: ticker.primary_exchange || "US",
            type: ticker.type || "Stock",
            isInWatchlist: false,
          };
          return item;
        })
        .slice(0, 15);

      return mapped;
    } catch (err) {
      console.error("Error in stock search:", err);
      return [];
    }
  }
);

// Get stock snapshot (current price and change)
export async function getStockSnapshot(symbol: string): Promise<{
  price: number;
  change: number;
  changePercent: number;
} | null> {
  try {
    if (!POLYGON_API_KEY) {
      throw new Error("POLYGON API key is not configured");
    }

    const url = `${POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(
      symbol.toUpperCase()
    )}?apiKey=${POLYGON_API_KEY}`;
    const data = await fetchJSON<PolygonSnapshot>(url, 60);

    if (data.ticker) {
      return {
        price: data.ticker.day?.c || data.ticker.prevDay?.c || 0,
        change: data.ticker.todaysChange || 0,
        changePercent: data.ticker.todaysChangePerc || 0,
      };
    }
    return null;
  } catch (err) {
    console.error("getStockSnapshot error:", err);
    return null;
  }
}

// Get stock aggregates (historical price data)
export async function getStockAggregates(
  symbol: string,
  timespan: "minute" | "hour" | "day" | "week" | "month" = "day",
  from?: string,
  to?: string
): Promise<
  Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>
> {
  try {
    if (!POLYGON_API_KEY) {
      throw new Error("POLYGON API key is not configured");
    }

    const range = from && to ? { from, to } : getDateRange(30);
    const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${encodeURIComponent(
      symbol.toUpperCase()
    )}/range/1/${timespan}/${range.from}/${
      range.to
    }?adjusted=true&sort=asc&apiKey=${POLYGON_API_KEY}`;

    const data = await fetchJSON<{
      results?: Array<{
        t: number;
        o: number;
        h: number;
        l: number;
        c: number;
        v: number;
      }>;
      status: string;
    }>(url, 300);

    if (!data.results) return [];

    return data.results.map((bar) => ({
      timestamp: bar.t,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
    }));
  } catch (err) {
    console.error("getStockAggregates error:", err);
    return [];
  }
}

// Get ticker details (company info)
export async function getTickerDetails(symbol: string): Promise<{
  name: string;
  description?: string;
  homepage?: string;
  marketCap?: number;
  employees?: number;
  listDate?: string;
  logo?: string;
} | null> {
  try {
    if (!POLYGON_API_KEY) {
      throw new Error("POLYGON API key is not configured");
    }

    const url = `${POLYGON_BASE_URL}/v3/reference/tickers/${encodeURIComponent(
      symbol.toUpperCase()
    )}?apiKey=${POLYGON_API_KEY}`;
    const data = await fetchJSON<PolygonTickerDetails>(url, 3600);

    if (data.results) {
      return {
        name: data.results.name,
        description: data.results.description,
        homepage: data.results.homepage_url,
        marketCap: data.results.market_cap,
        employees: data.results.total_employees,
        listDate: data.results.list_date,
        logo: data.results.branding?.logo_url,
      };
    }
    return null;
  } catch (err) {
    console.error("getTickerDetails error:", err);
    return null;
  }
}

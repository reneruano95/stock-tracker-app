// ============================================
// INNGEST DISABLED - Uncomment to re-enable
// ============================================
// To enable Inngest background jobs:
// 1. Uncomment the code below
// 2. Run: npx inngest-cli@latest dev
// 3. Set GEMINI_API_KEY in .env (or configure local AI)
// ============================================

// import {serve} from "inngest/next";
// import {inngest} from "@/lib/inngest/client";
// import {sendDailyNewsSummary} from "@/lib/inngest/functions";

// export const { GET, POST, PUT } = serve({
//     client: inngest,
//     functions: [sendDailyNewsSummary],
// })

// Placeholder exports to prevent build errors
export async function GET() {
  return Response.json({
    status: "disabled",
    message: "Inngest is currently disabled",
  });
}

export async function POST() {
  return Response.json({
    status: "disabled",
    message: "Inngest is currently disabled",
  });
}

export async function PUT() {
  return Response.json({
    status: "disabled",
    message: "Inngest is currently disabled",
  });
}

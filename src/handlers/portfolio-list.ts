import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard, paginate } from "../toolkit/index.js";

interface PortfolioItem {
  id: string;
  caption: string;
  serviceCategory: string;
  tags: string[];
}

const PORTFOLIO: PortfolioItem[] = [
  { id: "p1", caption: "Beautiful balayage transformation", serviceCategory: "Hair", tags: ["color", "balayage"] },
  { id: "p2", caption: "Elegant bridal updo", serviceCategory: "Hair", tags: ["styling", "bridal"] },
  { id: "p3", caption: "Classic French manicure", serviceCategory: "Nails", tags: ["manicure", "french"] },
  { id: "p4", caption: "Gel nails with nail art", serviceCategory: "Nails", tags: ["gel", "nail-art"] },
  { id: "p5", caption: "Relaxing facial treatment", serviceCategory: "Skin", tags: ["facial", "relaxation"] },
  { id: "p6", caption: "Natural lash extensions", serviceCategory: "Lashes", tags: ["extensions", "natural"] },
  { id: "p7", caption: "Bold makeup look", serviceCategory: "Makeup", tags: ["bold", "evening"] },
  { id: "p8", caption: "Subtle everyday makeup", serviceCategory: "Makeup", tags: ["natural", "everyday"] },
  { id: "p9", caption: "Vibrant hair color", serviceCategory: "Hair", tags: ["color", "vibrant"] },
  { id: "p10", caption: "Pedicure with nail art", serviceCategory: "Nails", tags: ["pedicure", "art"] },
];

const ITEMS_PER_PAGE = 4;

function getItemsByCategory(category: string): PortfolioItem[] {
  if (category === "all") return PORTFOLIO;
  return PORTFOLIO.filter(item => item.serviceCategory === category);
}

function renderPortfolioList(category: string, page: number): { text: string; keyboard: ReturnType<typeof inlineKeyboard> } {
  const items = getItemsByCategory(category);
  const { pageItems, page: actualPage, totalPages, controls } = paginate(items, {
    page,
    perPage: ITEMS_PER_PAGE,
    callbackPrefix: `portfolio:${category}:page`,
  });

  const categoryLabel = category === "all" ? "All categories" : category;
  const lines = [`Gallery — ${categoryLabel}`, "", `${items.length} photos available`, ""];

  const rows = pageItems.map(item => [
    inlineButton(item.caption, `portfolio:detail:${item.id}`),
  ]);

  const categoryButtons = [
    inlineButton("All", "portfolio:cat:all"),
    inlineButton("Hair", "portfolio:cat:Hair"),
    inlineButton("Nails", "portfolio:cat:Nails"),
    inlineButton("Skin", "portfolio:cat:Skin"),
    inlineButton("Lashes", "portfolio:cat:Lashes"),
    inlineButton("Makeup", "portfolio:cat:Makeup"),
  ];

  const keyboard = inlineKeyboard([
    categoryButtons,
    ...rows,
    ...controls.inline_keyboard,
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);

  return { text: lines.join("\n"), keyboard };
}

registerMainMenuItem({ label: "📸 Portfolio", data: "portfolio:list", order: 20 });

const composer = new Composer<Ctx>();

composer.callbackQuery("portfolio:list", async (ctx) => {
  await ctx.answerCallbackQuery();
  const { text, keyboard } = renderPortfolioList("all", 0);
  await ctx.reply(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^portfolio:cat:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const category = ctx.match[1];
  const { text, keyboard } = renderPortfolioList(category, 0);
  await ctx.editMessageText(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^portfolio:(.+):page:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const category = ctx.match[1];
  const page = parseInt(ctx.match[2], 10);
  const { text, keyboard } = renderPortfolioList(category, page);
  await ctx.editMessageText(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^portfolio:detail:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const item = PORTFOLIO.find(p => p.id === ctx.match[1]);
  if (!item) {
    await ctx.editMessageText("Photo not found. Try browsing other items?", {
      reply_markup: inlineKeyboard([
        [inlineButton("📸 Browse gallery", "portfolio:list")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const text = [
    item.caption,
    "",
    `Category: ${item.serviceCategory}`,
    `Tags: ${item.tags.join(", ")}`,
  ].join("\n");

  await ctx.editMessageText(text, {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to gallery", "portfolio:list")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;

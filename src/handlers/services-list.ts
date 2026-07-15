import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard, paginate } from "../toolkit/index.js";

interface Service {
  id: string;
  title: string;
  description: string;
  duration: number; // minutes
  price: number;
  category: string;
}

const SERVICES: Service[] = [
  { id: "haircut", title: "Haircut", description: "Classic cut and style", duration: 45, price: 45, category: "Hair" },
  { id: "color", title: "Hair Color", description: "Full color or highlights", duration: 90, price: 85, category: "Hair" },
  { id: "blowout", title: "Blowout", description: "Wash and blow dry styling", duration: 30, price: 35, category: "Hair" },
  { id: "manicure", title: "Manicure", description: "Classic nail care and polish", duration: 30, price: 25, category: "Nails" },
  { id: "pedicure", title: "Pedicure", description: "Foot care and nail polish", duration: 45, price: 40, category: "Nails" },
  { id: "gel_nails", title: "Gel Nails", description: "Long-lasting gel polish application", duration: 45, price: 40, category: "Nails" },
  { id: "facial", title: "Facial", description: "Deep cleansing and moisturizing", duration: 60, price: 65, category: "Skin" },
  { id: "chemical_peel", title: "Chemical Peel", description: "Exfoliating skin treatment", duration: 45, price: 95, category: "Skin" },
  { id: "lash_extensions", title: "Lash Extensions", description: "Individual lash application", duration: 90, price: 120, category: "Lashes" },
  { id: "lash_lift", title: "Lash Lift", description: "Semi-permanent lash curling", duration: 60, price: 75, category: "Lashes" },
  { id: "waxing", title: "Waxing", description: "Full body or facial waxing", duration: 30, price: 30, category: "Skin" },
  { id: "makeup", title: "Makeup Application", description: "Professional makeup for any occasion", duration: 60, price: 75, category: "Makeup" },
];

const ITEMS_PER_PAGE = 5;

function getServiceById(id: string): Service | undefined {
  return SERVICES.find(s => s.id === id);
}

function renderServiceList(page: number): { text: string; keyboard: ReturnType<typeof inlineKeyboard> } {
  const { pageItems, page: actualPage, totalPages, controls } = paginate(SERVICES, {
    page,
    perPage: ITEMS_PER_PAGE,
    callbackPrefix: "services:page",
  });

  const lines = ["Choose a treatment to see details and book:", ""];
  for (const s of pageItems) {
    lines.push(`${s.title} — ${s.duration}min · $${s.price}`);
  }

  const rows = pageItems.map(s => [
    inlineButton(s.title, `services:detail:${s.id}`),
  ]);

  const keyboard = inlineKeyboard([
    ...rows,
    ...controls.inline_keyboard,
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);

  return { text: lines.join("\n"), keyboard };
}

registerMainMenuItem({ label: "💅 Services", data: "services:list", order: 10 });

const composer = new Composer<Ctx>();

composer.callbackQuery("services:list", async (ctx) => {
  await ctx.answerCallbackQuery();
  const { text, keyboard } = renderServiceList(0);
  await ctx.reply(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^services:page:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const page = parseInt(ctx.match[1], 10);
  const { text, keyboard } = renderServiceList(page);
  await ctx.editMessageText(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^services:detail:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const service = getServiceById(ctx.match[1]);
  if (!service) {
    await ctx.editMessageText("Sorry, that service isn't available anymore. Try another one?", {
      reply_markup: inlineKeyboard([
        [inlineButton("💅 Browse services", "services:list")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const text = [
    `${service.title}`,
    "",
    `${service.description}`,
    `Duration: ${service.duration} minutes`,
    `Price: $${service.price}`,
  ].join("\n");

  await ctx.editMessageText(text, {
    reply_markup: inlineKeyboard([
      [inlineButton(`📅 Book ${service.title}`, `services:book:${service.id}`)],
      [inlineButton("⬅️ Back to services", "services:list")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;

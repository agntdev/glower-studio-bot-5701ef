import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard, paginate } from "../toolkit/index.js";
import { getDataStore, getServices, type ServiceData } from "../data-store.js";

const ITEMS_PER_PAGE = 5;

function renderServiceList(services: ServiceData[], page: number): { text: string; keyboard: ReturnType<typeof inlineKeyboard> } {
  const activeServices = services.filter(s => s.active);
  const { pageItems, page: actualPage, totalPages, controls } = paginate(activeServices, {
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
  const store = getDataStore(ctx.api);
  const services = await getServices(store);
  const { text, keyboard } = renderServiceList(services, 0);
  await ctx.reply(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^services:page:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const page = parseInt(ctx.match[1], 10);
  const store = getDataStore(ctx.api);
  const services = await getServices(store);
  const { text, keyboard } = renderServiceList(services, page);
  await ctx.editMessageText(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^services:detail:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const serviceId = ctx.match[1];
  const store = getDataStore(ctx.api);
  const services = await getServices(store);
  const service = services.find(s => s.id === serviceId);
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

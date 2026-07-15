import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const ADMIN_IDS = process.env.ADMIN_IDS?.split(",").map(id => parseInt(id.trim(), 10)) ?? [];

interface Service {
  id: string;
  title: string;
  description: string;
  duration: number;
  price: number;
  active: boolean;
}

const SERVICES: Service[] = [
  { id: "haircut", title: "Haircut", description: "Classic cut and style", duration: 45, price: 45, active: true },
  { id: "color", title: "Hair Color", description: "Full color or highlights", duration: 90, price: 85, active: true },
  { id: "blowout", title: "Blowout", description: "Wash and blow dry styling", duration: 30, price: 35, active: true },
  { id: "manicure", title: "Manicure", description: "Classic nail care and polish", duration: 30, price: 25, active: true },
  { id: "pedicure", title: "Pedicure", description: "Foot care and nail polish", duration: 45, price: 40, active: true },
  { id: "gel_nails", title: "Gel Nails", description: "Long-lasting gel polish application", duration: 45, price: 40, active: true },
  { id: "facial", title: "Facial", description: "Deep cleansing and moisturizing", duration: 60, price: 65, active: true },
  { id: "chemical_peel", title: "Chemical Peel", description: "Exfoliating skin treatment", duration: 45, price: 95, active: true },
  { id: "lash_extensions", title: "Lash Extensions", description: "Individual lash application", duration: 90, price: 120, active: true },
  { id: "lash_lift", title: "Lash Lift", description: "Semi-permanent lash curling", duration: 60, price: 75, active: true },
  { id: "waxing", title: "Waxing", description: "Full body or facial waxing", duration: 30, price: 30, active: true },
  { id: "makeup", title: "Makeup Application", description: "Professional makeup for any occasion", duration: 60, price: 75, active: true },
];

function isAdmin(userId: number): boolean {
  return ADMIN_IDS.length === 0 || ADMIN_IDS.includes(userId);
}

function renderAdminMenu(): { text: string; keyboard: ReturnType<typeof inlineKeyboard> } {
  const text = [
    "Admin Dashboard",
    "",
    "Manage your studio:",
  ].join("\n");

  const keyboard = inlineKeyboard([
    [inlineButton("⚙️ Manage Services", "admin:services")],
    [inlineButton("📸 Manage Portfolio", "admin:portfolio")],
    [inlineButton("⭐ Manage Reviews", "admin:reviews")],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);

  return { text, keyboard };
}

function renderServiceManagement(): { text: string; keyboard: ReturnType<typeof inlineKeyboard> } {
  const lines = ["Service Management:", ""];
  for (const s of SERVICES) {
    const status = s.active ? "✅" : "❌";
    lines.push(`${status} ${s.title} — ${s.duration}min · $${s.price}`);
  }

  const rows = SERVICES.map(s => [
    inlineButton(`${s.active ? "❌" : "✅"} ${s.title}`, `admin:toggle:${s.id}`),
  ]);

  const keyboard = inlineKeyboard([
    ...rows,
    [inlineButton("⬅️ Back to admin", "admin:menu")],
  ]);

  return { text: lines.join("\n"), keyboard };
}

function renderReviewManagement(): { text: string; keyboard: ReturnType<typeof inlineKeyboard> } {
  const text = [
    "Review Management:",
    "",
    "No new reviews to respond to.",
  ].join("\n");

  const keyboard = inlineKeyboard([
    [inlineButton("⬅️ Back to admin", "admin:menu")],
  ]);

  return { text, keyboard };
}

const composer = new Composer<Ctx>();

composer.command("admin", async (ctx) => {
  if (!isAdmin(ctx.from?.id ?? 0)) {
    await ctx.reply("Sorry, you don't have admin access. Contact the studio owner if you believe this is a mistake.");
    return;
  }

  const { text, keyboard } = renderAdminMenu();
  await ctx.reply(text, { reply_markup: keyboard });
});

composer.callbackQuery("admin:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx.from?.id ?? 0)) {
    await ctx.reply("Access denied.");
    return;
  }
  const { text, keyboard } = renderAdminMenu();
  await ctx.editMessageText(text, { reply_markup: keyboard });
});

composer.callbackQuery("admin:services", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx.from?.id ?? 0)) {
    await ctx.reply("Access denied.");
    return;
  }
  const { text, keyboard } = renderServiceManagement();
  await ctx.editMessageText(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^admin:toggle:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx.from?.id ?? 0)) {
    await ctx.reply("Access denied.");
    return;
  }

  const serviceId = ctx.match[1];
  const service = SERVICES.find(s => s.id === serviceId);
  if (service) {
    service.active = !service.active;
    await ctx.answerCallbackQuery({ text: `${service.title} ${service.active ? "enabled" : "disabled"}` });
  }

  const { text, keyboard } = renderServiceManagement();
  await ctx.editMessageText(text, { reply_markup: keyboard });
});

composer.callbackQuery("admin:portfolio", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx.from?.id ?? 0)) {
    await ctx.reply("Access denied.");
    return;
  }

  const text = [
    "Portfolio Management:",
    "",
    "Upload photos with captions and tags.",
    "Assign to service categories.",
    "Delete or edit existing items.",
  ].join("\n");

  await ctx.editMessageText(text, {
    reply_markup: inlineKeyboard([
      [inlineButton("📸 Upload Photo", "admin:portfolio:upload")],
      [inlineButton("🗑 Delete Photo", "admin:portfolio:delete")],
      [inlineButton("⬅️ Back to admin", "admin:menu")],
    ]),
  });
});

composer.callbackQuery("admin:portfolio:upload", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Send a photo with a caption in the format: caption | category (Hair, Nails, Skin, Lashes, Makeup)");
});

composer.callbackQuery("admin:portfolio:delete", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Send the photo ID you want to delete.");
});

composer.callbackQuery("admin:reviews", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx.from?.id ?? 0)) {
    await ctx.reply("Access denied.");
    return;
  }
  const { text, keyboard } = renderReviewManagement();
  await ctx.editMessageText(text, { reply_markup: keyboard });
});

export default composer;

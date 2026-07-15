import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getDataStore, getServices, getReviews, updateReview, type ServiceData } from "../data-store.js";

const ADMIN_IDS = process.env.ADMIN_IDS?.split(",").map(id => parseInt(id.trim(), 10)) ?? [];

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

async function renderServiceManagement(store: ReturnType<typeof getDataStore>): Promise<{ text: string; keyboard: ReturnType<typeof inlineKeyboard> }> {
  const services = await getServices(store);
  const lines = ["Service Management:", ""];
  for (const s of services) {
    const status = s.active ? "✅" : "❌";
    lines.push(`${status} ${s.title} — ${s.duration}min · $${s.price}`);
  }

  const rows = services.map(s => [
    inlineButton(`${s.active ? "❌ Disable" : "✅ Enable"} ${s.title}`, `admin:toggle:${s.id}`),
  ]);

  const keyboard = inlineKeyboard([
    ...rows,
    [inlineButton("⬅️ Back to admin", "admin:menu")],
  ]);

  return { text: lines.join("\n"), keyboard };
}

async function renderReviewManagement(store: ReturnType<typeof getDataStore>): Promise<{ text: string; keyboard: ReturnType<typeof inlineKeyboard> }> {
  const reviews = await getReviews(store);
  const unreplied = reviews.filter(r => !r.adminReply);

  if (unreplied.length === 0) {
    return {
      text: [
        "Review Management:",
        "",
        "No new reviews to respond to.",
      ].join("\n"),
      keyboard: inlineKeyboard([
        [inlineButton("⬅️ Back to admin", "admin:menu")],
      ]),
    };
  }

  const lines = ["Review Management:", ""];
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  for (const r of unreplied.slice(0, 10)) {
    const stars = "⭐".repeat(r.rating);
    lines.push(`${stars} — ${r.userName}: ${r.text || "(no text)"}`);
    rows.push([inlineButton(`Reply to ${r.userName}`, `admin:reply:${r.id}`)]);
  }

  const keyboard = inlineKeyboard([
    ...rows,
    [inlineButton("⬅️ Back to admin", "admin:menu")],
  ]);

  return { text: lines.join("\n"), keyboard };
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
  const store = getDataStore(ctx.api);
  const { text, keyboard } = await renderServiceManagement(store);
  await ctx.editMessageText(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^admin:toggle:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx.from?.id ?? 0)) {
    await ctx.reply("Access denied.");
    return;
  }

  const serviceId = ctx.match[1];
  const store = getDataStore(ctx.api);
  const services = await getServices(store);
  const idx = services.findIndex(s => s.id === serviceId);
  if (idx >= 0) {
    const updated = { ...services[idx], active: !services[idx].active };
    const newServices = [...services.slice(0, idx), updated, ...services.slice(idx + 1)];
    await store.set("glowe:services", newServices);
    await ctx.answerCallbackQuery({ text: `${updated.title} ${updated.active ? "enabled" : "disabled"}` });
  }

  const { text, keyboard } = await renderServiceManagement(store);
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
  const store = getDataStore(ctx.api);
  const { text, keyboard } = await renderReviewManagement(store);
  await ctx.editMessageText(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^admin:reply:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx.from?.id ?? 0)) {
    await ctx.reply("Access denied.");
    return;
  }

  const reviewId = ctx.match[1];
  ctx.session.adminStep = "responding_review";
  ctx.session.adminReviewId = reviewId;

  await ctx.reply("Type your reply to this review:", {
    reply_markup: { force_reply: true, input_field_placeholder: "Type your reply…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.adminStep !== "responding_review" || !ctx.session.adminReviewId) return next();
  if (!isAdmin(ctx.from?.id ?? 0)) return next();

  const replyText = ctx.message.text.trim();
  const store = getDataStore(ctx.api);
  await updateReview(store, ctx.session.adminReviewId, { adminReply: replyText });

  ctx.session.adminStep = "idle";
  ctx.session.adminReviewId = undefined;

  await ctx.reply("✅ Reply saved. The review author will be notified.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to admin", "admin:menu")],
    ]),
  });
});

export default composer;

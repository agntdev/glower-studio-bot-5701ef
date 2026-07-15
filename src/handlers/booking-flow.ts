import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, confirmKeyboard } from "../toolkit/index.js";
import { getDataStore, getServices, type ServiceData } from "../data-store.js";

const STUDIO_HOURS = { open: 9, close: 18 };

function now(): Date {
  return new Date();
}

function generateDates(count: number): string[] {
  const today = now();
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() !== 0) {
      dates.push(d.toISOString().split("T")[0]);
    }
  }
  return dates;
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = STUDIO_HOURS.open; h < STUDIO_HOURS.close; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function renderDatePicker(serviceId: string, page: number): { text: string; keyboard: ReturnType<typeof inlineKeyboard> } {
  const dates = generateDates(30);
  const perPage = 5;
  const totalPages = Math.ceil(dates.length / perPage);
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * perPage;
  const pageDates = dates.slice(start, start + perPage);

  const lines = ["Pick a date for your appointment:", ""];
  const rows = pageDates.map(date => [
    inlineButton(formatDate(date), `book:slot:${serviceId}:${date}`),
  ]);

  const controls: Array<Array<{ text: string; callback_data: string }>> = [];
  if (safePage > 0 || safePage < totalPages - 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push(inlineButton("« Prev", `book:cal:${serviceId}:${safePage - 1}`));
    if (safePage < totalPages - 1) nav.push(inlineButton("Next »", `book:cal:${serviceId}:${safePage + 1}`));
    controls.push(nav);
  }

  const keyboard = inlineKeyboard([
    ...rows,
    ...controls,
    [inlineButton("Cancel", "book:cancel")],
  ]);

  return { text: lines.join("\n"), keyboard };
}

function renderTimeSlots(serviceId: string, date: string): { text: string; keyboard: ReturnType<typeof inlineKeyboard> } {
  const slots = generateTimeSlots();
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < slots.length; i += 2) {
    const row: Array<{ text: string; callback_data: string }> = [];
    row.push(inlineButton(slots[i], `book:confirm:${serviceId}:${date}:${slots[i]}`));
    if (i + 1 < slots.length) {
      row.push(inlineButton(slots[i + 1], `book:confirm:${serviceId}:${date}:${slots[i + 1]}`));
    }
    rows.push(row);
  }

  const text = `Pick a time on ${formatDate(date)}:`;
  const keyboard = inlineKeyboard([
    ...rows,
    [inlineButton("Cancel", "book:cancel")],
  ]);

  return { text, keyboard };
}

async function completeBooking(ctx: Ctx): Promise<void> {
  const { bookingServiceId, bookingServiceName, bookingDate, bookingTime, bookingDuration, bookingPrice, bookingPhone } = ctx.session;
  if (!bookingServiceId || !bookingServiceName || !bookingDate || !bookingTime) {
    await ctx.reply("Something went wrong. Please start over.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  if (!ctx.session.bookingHistory) {
    ctx.session.bookingHistory = [];
  }
  ctx.session.bookingHistory.push({
    serviceId: bookingServiceId,
    serviceName: bookingServiceName,
    date: bookingDate,
    time: bookingTime,
    status: "confirmed",
    phone: bookingPhone,
  });

  ctx.session.bookingStep = "idle";
  ctx.session.bookingPhone = undefined;

  const confirmationText = [
    "✅ Booking confirmed!",
    "",
    `Service: ${bookingServiceName}`,
    `Date: ${formatDate(bookingDate)}`,
    `Time: ${bookingTime}`,
    "",
    "We'll send you a reminder before your appointment.",
  ].join("\n");

  await ctx.editMessageText(confirmationText, {
    reply_markup: inlineKeyboard([
      [inlineButton("📋 My Bookings", "bookings:history")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });

  // Notify staff group chat (best-effort)
  const staffGroupId = process.env.STAFF_GROUP_CHAT_ID;
  if (staffGroupId) {
    try {
      const clientName = ctx.from?.first_name ?? "Unknown";
      const phoneLine = bookingPhone ? `\nPhone: ${bookingPhone}` : "";
      await ctx.api.sendMessage(
        parseInt(staffGroupId, 10),
        [
          "📅 New booking!",
          "",
          `Service: ${bookingServiceName}`,
          `Date: ${formatDate(bookingDate)}`,
          `Time: ${bookingTime}`,
          `Duration: ${bookingDuration ?? "?"} min`,
          `Client: ${clientName}${phoneLine}`,
        ].join("\n"),
      );
    } catch (err) {
      console.error("Failed to notify staff group:", err);
    }
  }
}

const composer = new Composer<Ctx>();

composer.callbackQuery(/^services:book:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const serviceId = ctx.match[1];
  const store = getDataStore(ctx.api);
  const services = await getServices(store);
  const service = services.find(s => s.id === serviceId);
  if (!service || !service.active) {
    await ctx.reply("Sorry, that service isn't available. Try another one?", {
      reply_markup: inlineKeyboard([
        [inlineButton("💅 Browse services", "services:list")],
      ]),
    });
    return;
  }

  ctx.session.bookingStep = "selecting_date";
  ctx.session.bookingServiceId = serviceId;
  ctx.session.bookingServiceName = service.title;
  ctx.session.bookingDuration = service.duration;
  ctx.session.bookingPrice = service.price;

  const { text, keyboard } = renderDatePicker(serviceId, 0);
  await ctx.reply(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^book:cal:(.+):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const serviceId = ctx.match[1];
  const page = parseInt(ctx.match[2], 10);
  const { text, keyboard } = renderDatePicker(serviceId, page);
  await ctx.editMessageText(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^book:slot:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const serviceId = ctx.match[1];
  const date = ctx.match[2];

  ctx.session.bookingStep = "selecting_time";
  ctx.session.bookingDate = date;

  const { text, keyboard } = renderTimeSlots(serviceId, date);
  await ctx.editMessageText(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^book:confirm:(.+?):(.+?):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const serviceId = ctx.match[1];
  const date = ctx.match[2];
  const time = ctx.match[3];

  ctx.session.bookingStep = "confirming";
  ctx.session.bookingTime = time;

  const store = getDataStore(ctx.api);
  const services = await getServices(store);
  const service = services.find(s => s.id === serviceId);
  if (!service) {
    await ctx.reply("Sorry, something went wrong. Please try again.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const text = [
    "Confirm your booking:",
    "",
    `Service: ${service.title}`,
    `Date: ${formatDate(date)}`,
    `Time: ${time}`,
    `Duration: ${service.duration} minutes`,
    `Price: $${service.price}`,
  ].join("\n");

  await ctx.editMessageText(text, {
    reply_markup: confirmKeyboard("book:final"),
  });
});

composer.callbackQuery("book:final:yes", async (ctx) => {
  await ctx.answerCallbackQuery();

  ctx.session.bookingStep = "collecting_phone";

  await ctx.editMessageText(
    "What's your phone number? Type it below, or tap Skip to continue without sharing.",
    {
      reply_markup: inlineKeyboard([
        [inlineButton("Skip", "book:skip:phone")],
        [inlineButton("Cancel", "book:cancel")],
      ]),
    },
  );
});

composer.callbackQuery("book:final:no", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.bookingStep = "idle";

  await ctx.editMessageText("No worries! Your booking was cancelled. Tap a button below to continue.", {
    reply_markup: inlineKeyboard([
      [inlineButton("💅 Browse services", "services:list")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.bookingStep !== "collecting_phone") return next();

  const text = ctx.message.text.trim();
  if (text.length < 3) {
    await ctx.reply("That doesn't look like a valid phone number. Try again, or tap Skip.");
    return;
  }

  ctx.session.bookingPhone = text;
  await completeBooking(ctx);
});

composer.callbackQuery("book:skip:phone", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.bookingPhone = undefined;
  await completeBooking(ctx);
});

composer.callbackQuery("book:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.bookingStep = "idle";

  await ctx.editMessageText("Booking cancelled. Tap a button below to continue.", {
    reply_markup: inlineKeyboard([
      [inlineButton("💅 Browse services", "services:list")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;

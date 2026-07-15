import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";

interface BookingRecord {
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  status: "confirmed" | "completed" | "cancelled";
}

function getBookings(session: { bookingHistory?: Array<{ serviceId: string; serviceName: string; date: string; time: string; status: string }> }) {
  return session.bookingHistory ?? [];
}

function renderBookingHistory(bookings: Array<{ serviceId: string; serviceName: string; date: string; time: string; status: string }>): string {
  if (bookings.length === 0) {
    return "No bookings yet — tap 💅 Services to browse and book your first appointment.";
  }

  const lines: string[] = ["Your bookings:", ""];
  for (const b of bookings) {
    const statusEmoji = b.status === "confirmed" ? "🟢" : b.status === "completed" ? "✅" : "🔴";
    lines.push(`${statusEmoji} ${b.serviceName} — ${b.date} at ${b.time}`);
  }
  return lines.join("\n");
}

registerMainMenuItem({ label: "📋 My Bookings", data: "bookings:history", order: 30 });

const composer = new Composer<Ctx>();

composer.callbackQuery("bookings:history", async (ctx) => {
  await ctx.answerCallbackQuery();
  const bookings = getBookings(ctx.session);
  const text = renderBookingHistory(bookings);
  const keyboard = bookings.length > 0
    ? inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ])
    : inlineKeyboard([
        [inlineButton("💅 Browse services", "services:list")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]);

  await ctx.reply(text, { reply_markup: keyboard });
});

export default composer;

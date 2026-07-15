import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getDataStore, getReviews, addReview, type ReviewData } from "../data-store.js";

function getCompletedBookings(session: { bookingHistory?: Array<{ serviceId: string; serviceName: string; date: string; time: string; status: string }> }): Array<{ serviceId: string; serviceName: string; date: string; time: string; status: string }> {
  return (session.bookingHistory ?? []).filter(b => b.status === "completed" || b.status === "confirmed");
}

function renderRatingStars(rating: number): string {
  return "⭐".repeat(rating) + "☆".repeat(5 - rating);
}

function renderReviewPrompt(): { text: string; keyboard: ReturnType<typeof inlineKeyboard> } {
  const text = [
    "We'd love your feedback!",
    "",
    "How was your experience? Tap a rating below:",
  ].join("\n");

  const keyboard = inlineKeyboard([
    [
      inlineButton("1⭐", "review:rate:1"),
      inlineButton("2⭐", "review:rate:2"),
      inlineButton("3⭐", "review:rate:3"),
      inlineButton("4⭐", "review:rate:4"),
      inlineButton("5⭐", "review:rate:5"),
    ],
    [inlineButton("Cancel", "review:cancel")],
  ]);

  return { text, keyboard };
}

registerMainMenuItem({ label: "⭐ Leave Review", data: "reviews:submit", order: 40 });

const composer = new Composer<Ctx>();

composer.callbackQuery("reviews:submit", async (ctx) => {
  await ctx.answerCallbackQuery();
  const completed = getCompletedBookings(ctx.session);
  if (completed.length === 0) {
    await ctx.reply("You need to have a completed appointment before leaving a review. Book your first service below!", {
      reply_markup: inlineKeyboard([
        [inlineButton("💅 Browse services", "services:list")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  ctx.session.reviewStep = "rating";
  const { text, keyboard } = renderReviewPrompt();
  await ctx.reply(text, { reply_markup: keyboard });
});

composer.callbackQuery(/^review:rate:(\d)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const rating = parseInt(ctx.match[1], 10);
  ctx.session.reviewRating = rating;
  ctx.session.reviewStep = "text";

  await ctx.editMessageText(`You selected ${renderRatingStars(rating)}. Now tell us about your experience — what did you love? (Or tap Skip to submit without text.)`, {
    reply_markup: inlineKeyboard([
      [inlineButton("Skip", "review:skip:text")],
      [inlineButton("Cancel", "review:cancel")],
    ]),
  });
});

composer.callbackQuery("review:skip:text", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.reviewText = "";
  ctx.session.reviewStep = "photos";

  await ctx.editMessageText("Want to add photos of your results? You can upload up to 3 photos, or tap Skip to submit your review now.", {
    reply_markup: inlineKeyboard([
      [inlineButton("Skip", "review:skip:photos")],
      [inlineButton("Cancel", "review:cancel")],
    ]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.reviewStep !== "text") return next();

  ctx.session.reviewText = ctx.message.text;
  ctx.session.reviewStep = "photos";

  await ctx.reply("Want to add photos of your results? You can upload up to 3 photos, or tap Skip to submit your review now.", {
    reply_markup: inlineKeyboard([
      [inlineButton("Skip", "review:skip:photos")],
      [inlineButton("Cancel", "review:cancel")],
    ]),
  });
});

composer.on("message:photo", async (ctx) => {
  if (ctx.session.reviewStep !== "photos") return;

  await ctx.reply("Photo received! Add more photos or tap Submit when ready.", {
    reply_markup: inlineKeyboard([
      [inlineButton("Submit review", "review:submit")],
      [inlineButton("Cancel", "review:cancel")],
    ]),
  });
});

composer.callbackQuery("review:skip:photos", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.reviewStep = "confirming";

  const { reviewRating, reviewText } = ctx.session;
  const text = [
    "Review summary:",
    "",
    `Rating: ${renderRatingStars(reviewRating ?? 0)}`,
    reviewText ? `Review: ${reviewText}` : "",
    "",
    "Submit this review?",
  ].filter(Boolean).join("\n");

  await ctx.editMessageText(text, {
    reply_markup: inlineKeyboard([
      [inlineButton("✅ Submit", "review:submit")],
      [inlineButton("Cancel", "review:cancel")],
    ]),
  });
});

composer.callbackQuery("review:submit", async (ctx) => {
  await ctx.answerCallbackQuery();

  const { reviewRating, reviewText } = ctx.session;
  const completed = getCompletedBookings(ctx.session);
  const lastBooking = completed[completed.length - 1];

  const store = getDataStore(ctx.api);
  const review: ReviewData = {
    id: `rev_${Date.now()}`,
    rating: reviewRating ?? 5,
    text: reviewText ?? "",
    photos: [],
    bookingRef: lastBooking ? `${lastBooking.serviceId}_${lastBooking.date}` : "",
    userId: ctx.from?.id ?? 0,
    userName: ctx.from?.first_name ?? "Unknown",
    createdAt: new Date().toISOString(),
  };

  await addReview(store, review);

  ctx.session.reviewStep = "idle";
  ctx.session.reviewRating = undefined;
  ctx.session.reviewText = undefined;

  await ctx.editMessageText("✅ Thank you for your review! Your feedback helps us improve.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("review:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.reviewStep = "idle";

  await ctx.editMessageText("Review cancelled. Thanks anyway!", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;

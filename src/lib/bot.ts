import { Bot, InlineKeyboard } from "grammy";
import { CATEGORIES, Category, deleteExpense, insertExpense, updateExpenseCategory } from "./db";
import { parseManualEntry } from "./parse";

const token = process.env.TELEGRAM_BOT_TOKEN;
const allowedUserId = process.env.TELEGRAM_ALLOWED_USER_ID;

if (!token) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.");
}
if (!allowedUserId) {
  throw new Error("Missing TELEGRAM_ALLOWED_USER_ID environment variable.");
}

export const bot = new Bot(token);

// --- Single-user gate -------------------------------------------------
// This is a personal tracker. Anyone who finds the bot's @username on
// Telegram and messages it should be politely ignored, not logged.
bot.use(async (ctx, next) => {
  if (String(ctx.from?.id) !== allowedUserId) {
    // Deliberately vague reply — don't confirm this bot does anything.
    return;
  }
  await next();
});

function categoryKeyboard(expenseId: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  CATEGORIES.forEach((cat, i) => {
    kb.text(cat, `cat:${expenseId}:${cat}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row().text("↩️ Undo (delete this entry)", `undo:${expenseId}`);
  return kb;
}

function confirmedKeyboard(expenseId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✏️ Edit category", `edit:${expenseId}`)
    .text("↩️ Undo", `undo:${expenseId}`);
}

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Hi! Send me an expense like:\n\n" +
      "  12.50 lunch at Subway\n" +
      "  grabbed coffee $6\n\n" +
      "I'll log it and ask you to pick a category. " +
      "Amounts alone are fine too — I'll ask what it was for."
  );
});

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return; // let unhandled commands fall through

  const { amount, description } = parseManualEntry(text);

  if (amount === null) {
    await ctx.reply(
      "I couldn't find an amount in that message. Try something like \"12.50 lunch\"."
    );
    return;
  }

  const externalId = `telegram:${ctx.chat.id}:${ctx.message.message_id}`;

  const { data, error } = await insertExpense({
    amount,
    description,
    raw_text: text,
    source: "telegram",
    status: "pending_review",
    external_id: externalId,
  });

  if (error) {
    // 23505 = unique_violation -> this exact message was already processed
    // (e.g. a retried webhook delivery). Treat as a silent success, not an error.
    if (error.code === "23505") return;

    console.error("Failed to insert expense:", error);
    await ctx.reply("Something went wrong saving that — please try again.");
    return;
  }

  const amountLabel = `${data.currency} ${Math.abs(data.amount).toFixed(2)}`;
  await ctx.reply(
    `Logged ${amountLabel}${description ? ` — ${description}` : ""}.\n` +
      "What category is this?",
    { reply_markup: categoryKeyboard(data.id) }
  );
});

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const [action, expenseId, payload] = data.split(":");

  if (action === "cat" && payload) {
    const category = payload as Category;
    const { data: updated, error } = await updateExpenseCategory(expenseId, category, "user_corrected");

    if (error || !updated) {
      await ctx.answerCallbackQuery({ text: "Couldn't update that — try again." });
      return;
    }

    await ctx.editMessageText(
      `Logged ${updated.currency} ${Math.abs(updated.amount).toFixed(2)}` +
        `${updated.description ? ` — ${updated.description}` : ""}\n` +
        `Category: ${updated.category} ✅`,
      { reply_markup: confirmedKeyboard(updated.id) }
    );
    await ctx.answerCallbackQuery();
    return;
  }

  if (action === "edit") {
    await ctx.editMessageReplyMarkup({ reply_markup: categoryKeyboard(expenseId) });
    await ctx.answerCallbackQuery({ text: "Pick a new category" });
    return;
  }

  if (action === "undo") {
    const { error } = await deleteExpense(expenseId);
    if (error) {
      await ctx.answerCallbackQuery({ text: "Couldn't delete that — try again." });
      return;
    }
    await ctx.editMessageText("Entry deleted.");
    await ctx.answerCallbackQuery({ text: "Deleted" });
    return;
  }

  await ctx.answerCallbackQuery();
});

bot.catch((err) => {
  console.error("Unhandled bot error:", err.error);
});

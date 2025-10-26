import express from "express";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


const token = process.env.BOT_TOKEN;
const renderURL = process.env.RENDER_URL?.replace(/\/$/, ""); // optional, used for webhook
const port = process.env.PORT || 10000;

if (!token) {
  console.error("Missing BOT_TOKEN in environment variables");
  process.exit(1);
}

const app = express();
app.use(express.json());

// Initialize bot (webhook mode)
const bot = new TelegramBot(token);
const webhookPath = `/bot${token}`;
const webhookURL = `${renderURL || "https://sigmasbot.onrender.com"}${webhookPath}`;

// Set the webhook
(async () => {
  try {
    await bot.setWebHook(webhookURL);
    console.log(`Webhook set: ${webhookURL}`);
  } catch (err) {
    console.error("Error setting webhook:", err);
  }
})();

// Handle Telegram webhook updates
app.post(webhookPath, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Simple root route
app.get("/", (req, res) => res.send("sigma"));
app.listen(port, () => console.log(`Server running on port ${port}`));

// --- Self-ping to keep Render awake ---
const selfPingURL = "https://sigmasbot.onrender.com";
setInterval(() => {
  fetch(selfPingURL)
    .then(() => console.log("Self-ping OK"))
    .catch((err) => console.error("Self-ping failed:", err));
}, 14 * 60 * 1000); // every 14 minutes

// --- Message Counting Logic ---
const messageCounts = {};
const startDate = new Date();

bot.on("message", (msg) => {
  if (!msg.from) return; // ignore service/system messages

  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!messageCounts[chatId]) messageCounts[chatId] = {};
  if (!messageCounts[chatId][userId]) messageCounts[chatId][userId] = 0;

  messageCounts[chatId][userId]++;
});

// --- /messages command ---
bot.onText(/^\/messages$/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;

  const endDate = new Date();
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];
  const count = messageCounts[chatId]?.[userId] || 0;

  bot.sendMessage(chatId, `You sent ${count} messages from ${startStr} to ${endStr}`);
});

// --- /messages <id> command ---
bot.onText(/^\/messages (\d+)$/, (msg, match) => {
  const chatId = msg.chat.id;
  const targetId = match[1];
  const requesterId = msg.from?.id;
  if (!requesterId) return;

  const endDate = new Date();
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];
  const count = messageCounts[chatId]?.[targetId] || 0;

  bot.sendMessage(
    chatId,
    `User with ID ${targetId} has sent ${count} messages from ${startStr} to ${endStr}`
  );

  console.log(`User ${requesterId} checked messages for ID ${targetId}`);
});

bot.onText(/^\/gpt (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[1];

  try {
    await bot.sendChatAction(chatId, "typing");

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        { role: "system", content: "You are a toxic assistant inside a Telegram bot, and your goal is to answer the prompt, but offensively. Try to answer simply, outputting a max of about a paragraph or two at a time. If users become offended, and they say it, you need to apologise." },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 175,
    });

    const reply = response.choices[0].message.content.trim();
    bot.sendMessage(chatId, reply || "I didn’t get a response.");
  } catch (err) {
    console.error("Error calling GPT:", err);
    bot.sendMessage(chatId, "Something went wrong with GPT. Try again later.");
  }
});


// --- /start command ---
bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    "i heard that, and im counting, and everything is fine, and there might be bugs but dont worry about those rn, but at least there are no deploy issues 💖"
  );
});








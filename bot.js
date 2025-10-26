// bot.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";


const token = process.env.BOT_TOKEN;
const renderURL = process.env.RENDER_URL;
const port = process.env.PORT || 10000;

if (!token || !renderURL) {
  console.error("Missing BOT_TOKEN or RENDER_URL in environment variables");
  process.exit(1);
}

const app = express();
app.use(express.json());

const bot = new TelegramBot(token);
const webhookPath = `/bot${token}`;
const webhookURL = `${renderURL}${webhookPath}`;

bot
  .setWebHook(webhookURL)
  .then(() => console.log(`Webhook set: ${webhookURL}`))
  .catch((err) => console.error("Error setting webhook:", err));

app.post(webhookPath, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get("/", (req, res) => res.send("sigma"));
app.listen(port, () => console.log(`Server running on port ${port}`));

// cheating
setInterval(() => {
  fetch(renderURL)
    .then(() => console.log("Self-ping OK"))
    .catch((err) => console.error("Self-ping failed:", err));
}, 10 * 60 * 1000); // every 10 minutes

const messageCounts = {};
const startDate = new Date(); // when counting began

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!messageCounts[chatId]) messageCounts[chatId] = {};
  if (!messageCounts[chatId][userId]) messageCounts[chatId][userId] = 0;

  messageCounts[chatId][userId]++;
});

bot.onText(/\/messages/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const endDate = new Date();
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];
  const count = messageCounts[chatId]?.[userId] || 0;

  bot.sendMessage(
    chatId,
    `You sent ${count} messages from ${startStr} to ${endStr}`
  );
});

// Command to check another user's message count by ID
bot.onText(/\/messages (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const targetId = match[1]; // captured ID number from command
  const requesterId = msg.from.id;

  const endDate = new Date();
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  const count = messageCounts[chatId]?.[targetId] || 0;

  bot.sendMessage(
    chatId,
    `User with ID ${targetId} has sent ${count} messages from ${startStr} to ${endStr}`
  );

  // mods going crazy rn
  console.log(`User ${requesterId} checked messages for ID ${targetId}`);
});


// --- OPTIONAL: /start ---
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "i heard that, and im counting, and everything is fine, and there might be bugs but dont worry about those rn, but at least there are no deploy issues :sparkling_heart:");
});






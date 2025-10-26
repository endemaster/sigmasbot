// bot.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";

const token = process.env.BOT_TOKEN;
const renderURL = process.env.RENDER_URL; // e.g. https://sigma-bot.onrender.com
const port = process.env.PORT || 10000;

if (!token || !renderURL) {
  console.error("❌ Missing BOT_TOKEN or RENDER_URL in environment variables");
  process.exit(1);
}

const bot = new TelegramBot(token);
const app = express();
app.use(express.json());

const webhookPath = `/bot${token}`;
const webhookURL = `${renderURL}${webhookPath}`;

bot
  .setWebHook(webhookURL)
  .then(() => console.log(`✅ Webhook set: ${webhookURL}`))
  .catch((err) => console.error("❌ Error setting webhook:", err))

app.post(webhookPath, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "sigma in development rn, its a testing phase");
});

app.get("/", (req, res) => res.send("its a bird... its a plane...... its a SIGMA"));

app.listen(port, () => console.log(`🌐 Server running on port ${port}`));
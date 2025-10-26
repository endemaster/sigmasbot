import express from "express";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";

// --- Whitelist Configuration ---
const whitelist = [
  5357678423, // ende
  8076161215, // miki
  78650586, // jasperjana
  1127562842, // mrsigmaohio
  7371804734, // monkey lee
  6039702880, // twentyonepilots fan
  6556325430, // tim
  7505831865, // bart
  5615559047, // daniel yu
  1958152341, // philip
  1675886817, // zhenya
  5706761828, // sigma wu
  7468269948, // luna
  2674230603, // nate
];


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
  const userId = msg.from?.id;
  const prompt = match[1];

  // --- Whitelist check ---
  if (!whitelist.includes(userId)) {
    return bot.sendMessage(chatId, "You are not whitelisted!");
  }

  try {
    await bot.sendChatAction(chatId, "typing");

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content:
            "You are a nice Telegram assistant bot, and you will align yourself with Christian values, and try to act like a cute girl to troll people.",
        },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 200,
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
    "no deploy issues. if you are whitelisted, try the gpt command and give it a prompt!"
  );
});




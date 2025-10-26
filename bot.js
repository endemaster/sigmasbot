import express from "express";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";

// --- Whitelist Configuration ---
const whitelist = [
  5357678423, // ende
  8076161215, // miki
  78650586,   // jasperjana
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
  1313141417, // nate
];

// --- Multi-Threaded GPT Memory ---
const userConversations = {}; // { userId: { [threadId]: [ { role, content } ] } }
const MAX_MEMORY_MESSAGES = 100;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const token = process.env.BOT_TOKEN;
const renderURL = process.env.RENDER_URL?.replace(/\/$/, "");
const port = process.env.PORT || 10000;

if (!token) {
  console.error("Missing BOT_TOKEN in environment variables");
  process.exit(1);
}

const app = express();
app.use(express.json());

// Initialize bot (webhook mode)
const bot = new TelegramBot(token, { webHook: true });
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

// --- /gpt <[id]/> <prompt> command ---
bot.onText(/^\/gpt\s*<\[(\d+)\]\/>\s*(.+)$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const threadId = parseInt(match[1]);
  const prompt = match[2];

  if (!whitelist.includes(userId)) {
    return bot.sendMessage(chatId, "You are not whitelisted!");
  }

  // Initialize user's conversation threads
  if (!userConversations[userId]) userConversations[userId] = {};
  if (!userConversations[userId][threadId]) {
    userConversations[userId][threadId] = [
      { role: "system", content: "You are a zesty and kind Telegram assistant bot." },
    ];
  }

  try {
    await bot.sendChatAction(chatId, "typing");

    // Add user message
    userConversations[userId][threadId].push({ role: "user", content: prompt });

    // Trim memory
    if (userConversations[userId][threadId].length > MAX_MEMORY_MESSAGES) {
      userConversations[userId][threadId] =
        userConversations[userId][threadId].slice(-MAX_MEMORY_MESSAGES);
    }

    // GPT response
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: userConversations[userId][threadId],
      max_completion_tokens: 200,
    });

    const reply = response.choices[0].message.content.trim();

    // Save assistant reply
    userConversations[userId][threadId].push({ role: "assistant", content: reply });

    bot.sendMessage(chatId, `Chat [${threadId}]:\n${reply}`);
  } catch (err) {
    console.error("Error calling GPT:", err);
    bot.sendMessage(chatId, "Something went wrong with GPT. Try again later.");
  }
});

// --- /newgpt command: create new thread ---
bot.onText(/^\/newgpt$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  if (!whitelist.includes(userId)) {
    return bot.sendMessage(chatId, "You are not whitelisted!");
  }

  if (!userConversations[userId]) userConversations[userId] = {};

  const newId = Object.keys(userConversations[userId]).length;

  userConversations[userId][newId] = [
    { role: "system", content: "You are a zesty and kind Telegram assistant bot." },
  ];

  await bot.sendMessage(
    chatId,
    `new chat created [${newId}].\n`
  );
});

// --- /listgpt command: list threads ---
bot.onText(/^\/listgpt$/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  if (!whitelist.includes(userId)) {
    return bot.sendMessage(chatId, "You are not whitelisted!");
  }

  const threads = Object.keys(userConversations[userId] || {});
  if (threads.length === 0) {
    return bot.sendMessage(chatId, "no active chats");
  }

  const list = threads.map((id) => `Chat [${id}]`).join("\n");
  bot.sendMessage(chatId, `Your active GPT chats:\n\n${list}`);
});

// --- /start command ---
bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    "no deploy issues. if you are whitelisted, do /gpt and prompt to make a chat"
  );
});

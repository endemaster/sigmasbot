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
  1313141417, // nate
 
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





// --- /gpt command ---
bot.onText(/^\/gpt (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const prompt = match[1]; // Capture everything after "/gpt "

  // --- Whitelist check ---
  if (!whitelist.includes(userId)) {
    await bot.sendMessage(chatId, "You are not whitelisted!");
    return;
  }

  try {
    await bot.sendChatAction(chatId, "typing");

    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: "You are a nice Telegram assistant bot, and be zesty as hell.",
        },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 267,
    });

    const reply = response.choices[0].message.content.trim();
    await bot.sendMessage(chatId, reply || "OpenAI's servers are down for Telegram API.");
  } catch (err) {
    console.error("Error calling GPT:", err);
    await bot.sendMessage(chatId, "Something went wrong with GPT. Try again later.");
  }
});

// --- /start command ---
bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    "deploy issues are none. if you are whitelisted, try the gpt command and give it a prompt"
  );
});




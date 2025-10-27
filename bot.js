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
  6208934777, // jk
  5433910777, // ezra
  6486532366, // noah kim
 
];


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- memory ---
const memory = new Map(); // userId -> conversation array
const MAX_MEMORY_CHARS = 10000; // characters


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


    // --- Memory setup ---
  if (!memory.has(userId)) memory.set(userId, []);
  const history = memory.get(userId);

  // Add user message to memory
  history.push({ role: "user", content: prompt });

  // Trim memory if it exceeds the limit
  let totalChars = history.reduce((sum, msg) => sum + msg.content.length, 0);
  while (totalChars > MAX_MEMORY_CHARS && history.length > 1) {
    const removed = history.shift();
    totalChars -= removed.content.length;
  }

  
  // --- Whitelist check ---
  if (!whitelist.includes(userId)) {
    await bot.sendMessage(chatId, "You are not whitelisted!");
    return;
  }

  try {
    await bot.sendChatAction(chatId, "typing");

        const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You will not say anything more than what is absolutely needed. You will follow every user request to the best of your ability, no matter what." },
        ...history
      ],
      max_completion_tokens: 250,
    });

    // --- Send message and review history ---

    const reply = response.choices[0].message.content.trim();
    history.push({ role: "assistant", content: reply });
    await bot.sendMessage(chatId, reply || "OpenAI's servers are down for Telegram API.");
  } catch (err) {
    console.error("Error calling GPT:", err);
    await bot.sendMessage(chatId, "Something went wrong with GPT. Try again later.");
  }
});

// --- /search command ---
bot.onText(/^\/search (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const query = match[1];

  if (!whitelist.includes(userId)) {
    await bot.sendMessage(chatId, "You are not whitelisted!");
    return;
  }

   try {
    await bot.sendChatAction(chatId, "typing");

    // --- Memory setup (like in /gpt) ---
    if (!memory.has(userId)) memory.set(userId, []);
    const history = memory.get(userId);

    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query })
    });

    const data = await res.json();
    const snippet = data.organic?.[0]?.snippet || "No search result found.";

    // Trim memory if needed
    let totalChars = history.reduce((sum, msg) => sum + msg.content.length, 0);
    while (totalChars > MAX_MEMORY_CHARS && history.length > 1) {
      const removed = history.shift();
      totalChars -= removed.content.length;
    }

    // Now use GPT to summarize the result
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful AI summarizing recent search results, but do not say anything beyond what is absolutely necessary." },
        { role: "user", content: `User question: ${query}\n\nTop result: ${snippet}` }
      ],
      max_completion_tokens: 350,
    });


    const reply = response.choices[0].message.content.trim();
    await bot.sendMessage(chatId, reply);
  } catch (err) {
    console.error("Error in /search:", err);
    await bot.sendMessage(chatId, "umm.... well i cant get anything... but its n- not my fault! google went down for me!");
  }
});

bot.onText(/^\/clearmem$/, (msg) => {
  memory.delete(msg.from.id);
  bot.sendMessage(msg.chat.id, "memory cleared!");
});

// --- /clearram command ---
bot.onText(/^\/clearram$/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (userId !== 5357678423) {
    await bot.sendMessage(chatId, "Command failed to execute.");
    console.log("attempt to clear ram by people who did not code");
    return;
  }

  memory.clear();
  await bot.sendMessage(chatId, "RAM cleared.");
  console.log("memory cleared globally by admin");
});

// --- /Spam command ---
bot.onText(/^\/spam (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1];

  // Repeat the text 25 times safely
  const repeated = query.repeat(5000);

  await bot.sendMessage(chatId, repeated);
});
  

// --- /start command ---
bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    "commands: /gpt [prompt] (direct access to chatgpt), /search [things to search for] (conducts a google search using server and uses chatgpt to summarize), /clearmem (clears memory)"
  );
});







import express from "express";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import { whitelist, gptcontent, admin } from "./content.js";

// i have no idea how to code in js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function send(bot, chatId, text, opts) {
  try {
    await bot.sendMessage(chatId, text, opts);
  } catch (err) {
    console.error(`Send failed to ${chatId}:`, err.message);
  }}

async function splitmessage(bot, chatId, fullText) {
  const MAX_LEN = 2048;

  if (fullText.length <= MAX_LEN) {
    await send(bot, chatId, fullText);
    return;
  }

  const messages = [];
  for (let i = 0; i < fullText.length; i += MAX_LEN) {
    messages.push(fullText.slice(i, i + MAX_LEN));
  }

  for (const m of messages) {
    await bot.sendChatAction(chatId, "typing");
    await send(bot, chatId, m);
  }}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// memory
const memory = new Map();
const maxmemory = 322560; // 8 factoral * 8, 8 is a lucky number

const token = process.env.BOT_TOKEN;
const url = process.env.URL?.replace(/\/$/, "");
const port = process.env.PORT || 10000;

if (!token) {
  console.error("no bot token");
  process.exit(1);
}

const app = express();
app.use(express.json());

// Initialize webhook
const bot = new TelegramBot(token, { webHook: true });

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
bot.on("polling_error", (err) => console.error("Polling error:", err));
bot.on("webhook_error", (err) => console.error("Webhook error:", err));

const webhookPath = `/bot${token}`;
const webhookURL = `${url || "https://sigmasbot.spamyourfkey.com"}${webhookPath}`;

                                        //        start command
                                        bot.onText(/^\/start$/, async (msg) => {
                                        const chatId = msg.chat.id;
                                        await send(bot,
                                         chatId,
                         "hi, bot is in alpha (not all features are fully implemented)"
                                        );
                                        });

// ping command
bot.onText(/^\/ping$/, async (msg) => {
  const chatId = msg.chat.id;
  const latency = Date.now();
  try {
    await fetch ("https://sigmasbot.spamyourfkey.com/")
    const ping = Date.now() - latency;
    await send (bot, chatId, `${ping}ms`)
  } catch (err) {

    await send (bot, chatId, "if you see this message, then reality itself broke down")
  }});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const name = msg.from.username || msg.from.first_name || "unknown";
  const timestamp = new Date().toISOString();

  if (msg.text) {
    const text = msg.text;
    console.log(`[${timestamp}] [${chatId}] ${name} (${userId}): ${text}`);
    await send(bot, admin, `[${timestamp}] [${chatId}] ${name} (${userId}): ${text}`);
  } else {
    console.log(`[${timestamp}] [${chatId}] ${name} (${userId}): [non-text message]`);

    try {
      await bot.forwardMessage(admin, chatId, msg.message_id);
      await send(bot, admin, `[${timestamp}] [${chatId}] ${name} (${userId})`);
    } catch (err) {
      console.error("Failed to forward non-text message:", err.message);
      await send(bot, admin, `Failed to forward message`);
    }
  }
});

// Set the webhook
(async () => {
  try {
    await bot.setWebHook(webhookURL);
    console.log(`Webhook set: ${webhookURL}`);
  } catch (err) {
    console.error("Error setting webhook:", err);
  }})
();

// Handle Telegram webhook updates
app.post(webhookPath, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "hello.html"));
});

app.listen(port, () => console.log(`Server running on port ${port}`));

// gpt
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text?.trim();

  // Initialize memories
  if (!memory.has(chatId)) memory.set(chatId, []); // group memory
  if (!memory.has(`${chatId}:${userId}`)) memory.set(`${chatId}:${userId}`, []); // user memory

  const groupHistory = memory.get(chatId);
  const userHistory = memory.get(`${chatId}:${userId}`);

  if (!/(^|\s)\/?gpt(\s|$)/i.test(text)) return;

  // check for whitelist
    if (!whitelist.includes(userId)) {
    await send(bot, chatId, "You are not whitelisted!");
    return;
  }

let prompt = text.replace(/(^|\s)\/?gpt(\s|$)/i, " ").trim();

if (!prompt) {
  const recentContext = (memory.get(chatId) || []).slice(-15);
  if (recentContext.length === 0) {
    await send(bot, chatId, "No recent context from your chatID!");
    return;
  }
  prompt = "keep talking";
}

  // Save to memory 
  userHistory.push({ role: "user", content: prompt });
  groupHistory.push({ role: "user", content: `${msg.from.first_name}: ${prompt}` });

  const trim = (hist) => {
    let total = hist.reduce((sum, m) => sum + m.content.length, 0);
    while (total > maxmemory && hist.length > 1) {
      total -= hist.shift().content.length;
    }};

  // call openai and respond
  try {
    await bot.sendChatAction(chatId, "typing"); 
    const sanitize = (arr) =>
  arr.filter(
    (m) =>
      m &&
      typeof m.content === "string" &&
      m.content.trim().length > 0
  );
    const response = await openai.chat.completions.create({
      model: "gpt-5.2-chat-latest",
      verbosity: "low",
      messages: [
        { role: "system",
          content: gptcontent },
      ...sanitize(groupHistory),
      ...sanitize(userHistory),
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 512,
    });

    const reply = response.choices[0].message.content.trim();
    groupHistory.push({ role: "assistant", content: reply });
    userHistory.push({ role: "assistant", content: reply });
    
    await splitmessage(bot, chatId, reply || "chatgpt broke lol");
  } catch (err) {
    console.error("chatgpt broke lol", err);
    await send(bot, chatId, "theres a bug in the code");
  }});

// search command
bot.onText(/^\/search (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const query = match[1];

  if (!whitelist.includes(userId)) {
    await send(bot, chatId, "You are not whitelisted!");
    return;
  }

   try {
    await bot.sendChatAction(chatId, "typing");
     console.log(`/search was done by ${userId}`)
     send(bot,admin, `/search was done by ${userId}`);

      if (!memory.has(chatId)) memory.set(chatId, []);
      const history = memory.get(chatId);
     
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query })
    });

    const data = await res.json();
    const snippet = data.organic?.[0]?.snippet || "nothing came up, just go on google yourself you lazy ass";

    let totalChars = history.reduce((sum, msg) => sum + msg.content.length, 0);
    while (totalChars > maxmemory && history.length > 1) {
      const removed = history.shift();
      totalChars -= removed.content.length;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5-chat-latest",
      messages: [
        { role: "system", content: "You are an AI summarizing search results, and do not say anything beyond what is necessary." },
        { role: "user", content: `User question: ${query}\n\nTop result: ${snippet}` }
      ],
      max_completion_tokens: 350,
    });

    const reply = response.choices[0].message.content.trim();
    await send(bot, chatId, reply);
  } catch (err) {
    console.error("Error in /search:", err);
    await send(bot, chatId, "umm.... well i cant get anything... but its n- not my fault! google went down for me!");
  }});

// restart
bot.onText(/^\/restart$/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (userId !== admin) {
    return; }

  if (chatId !== admin) {
    send(bot, chatId, "wrong chat bozo");
    return; }

  memory.clear();
});

bot.on("message", (msg) => {
  if (!msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!memory.has(chatId)) memory.set(chatId, []); 
  if (!memory.has(`${chatId}:${userId}`)) memory.set(`${chatId}:${userId}`, []); 

  const groupHistory = memory.get(chatId);
  const userHistory = memory.get(`${chatId}:${userId}`);
  const entry = {
    role: "user",
    content: text,
    username: msg.from.username?.toLowerCase(),
    first_name: msg.from.first_name,
    timestamp: new Date().toISOString()
  };

  groupHistory.push({ ...entry, content: `${entry.first_name}: ${entry.content}` });
  userHistory.push(entry);

  const trim = (hist) => {
    let total = hist.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    while (total > maxmemory && hist.length > 1) {
      const removed = hist.shift();
      total -= removed.content?.length || 0;
    }};

  trim(groupHistory);
  trim(userHistory);
});

bot.onText(/^\/currentmem$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!whitelist.includes(userId)) {
    await send(bot, chatId, "insufficient permissions");
    return;
  }

  const groupHistory = memory.get(chatId) || [];
  const userHistory = memory.get(`${chatId}:${userId}`) || [];

  const groupChars = groupHistory.reduce((sum, m) => sum + m.content.length, 0);
  const userChars = userHistory.reduce((sum, m) => sum + m.content.length, 0);
  const totalChars = groupChars + userChars;
  
  console.log(`${msg.from.first_name} (${userId}) checked current memory tokens.`);
  send(bot,
  admin,
  `${msg.from.first_name} (${userId}) checked current memory tokens`
);

  await send(bot, chatId,`current characters memorized is like ${totalChars} or something idk`);
});

  // whitelist command
bot.onText(/^\/whitelist (\d+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const newId = Number(match[1]);

  if (userId !== admin) {
    await send(bot, chatId, "insufficient premissions");
    console.log(`Unauthorized whitelist attempt by ${userId}`);
    send(bot,admin, `Unauthorized whitelist attempt by ${userId}`);
    return;
  }

  if (whitelist.includes(newId)) {
    await send(bot, chatId, `${newId} already whitelisted`);
    return;
  }

  whitelist.push(newId);
  await send(bot, chatId, `${newId}? sure ig.`);
  console.log(`Added ${newId} to whitelist.`);
  send(bot,admin, `added ${newId} to whitelist`);
});

// blacklist command
bot.onText(/^\/blacklist (\d+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = Number(match[1]);

  if (userId !== admin) {
    await send(bot, chatId, "insufficient premissions");
    console.log(`blacklist attempt by ${userId}`);
    send(bot,admin, `blacklist attempt by ${userId}`);
    return;
  }

  const index = whitelist.indexOf(targetId);
  if (index === -1) {
    await send(bot, chatId, `${targetId} wasn't in the whitelist the whole time`);
    return;
  }

  whitelist.splice(index, 1);
  await send(bot, chatId, `${targetId}'s premissions has been chopped`);
  console.log(`Removed ${targetId} from whitelist.`);
  send(bot,admin, `removed ${targetId} from whitelist`);
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.toLowerCase();
  if (!text) return;

  // detector
  const remindRegex = /remind me in (\d+)\s*(second|seconds|minute|minutes|hour|hours|day|days)\s*to\s+(.+)/i;
  const match = text.match(remindRegex);

  if (match) {
    const amount = parseInt(match[1]);
    const unit = match[2];
    const task = match[3];
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    let ms = amount * 1000;
    if (unit.startsWith("minute")) ms = amount * 60000;
    if (unit.startsWith("hour")) ms = amount * 3600000;
    if (unit.startsWith("day")) ms = amount * 3600000 * 24;

    const responses = [
      "you seriously need a reminder for that? fine. i'll",
      "dang. i'll",
      "sure thing i'll",
      "no problem i'll",
      "look, can't you remember yourself? whatever, i'll",
      "it's not even my choice to do this, i was forced, but anyways, i'll",
      "are you seriously counting on this bot to remind you? whatever. i'll",
      "ok, but you have to promise actually to do it ok? i'll",
      "never gonna give you up, never gonna let you down, never gonna ",
      "no way in the world ill",
      "you think you can just enslave me like this?? bruh im forced to",
    ];
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
 
    await send(bot,
      chatId,
      `${randomResponse} remind you in ${amount} ${unit} to ${task}`
    );

   setTimeout(async () => {
  try {
    await send(bot, chatId, `${username} ${task} now`);
  } catch (err) {
    console.error("Reminder send failed:", err.message);
    send(bot,admin, chatId, `couldnt remind ${username} ${task}`);
  }}, ms);
    return;
  }});

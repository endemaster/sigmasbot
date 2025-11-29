import express from "express";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import { 
  saveMessage,
  getUserHistory,
  getGroupHistory,
  saveUsername,
  findUserByUsername
} from "./db.js";

// i have no idea how to code in js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function safeSend(bot, chatId, text, opts) {
  try {
    await bot.sendMessage(chatId, text, opts);
  } catch (err) {
    console.error(`Send failed to ${chatId}:`, err.message);
  }
}

async function sendSplitMessage(bot, chatId, fullText) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const MAX_LEN = 3000; // Telegram limit is 4096 chars per message

  if (fullText.length <= MAX_LEN) {
    await safeSend(bot, chatId, fullText);
    return;
  }

  const messages = [];
  for (let i = 0; i < fullText.length; i += MAX_LEN) {
    messages.push(fullText.slice(i, i + MAX_LEN));
  }

  for (const m of messages) {
    await bot.sendChatAction(chatId, "typing");
    await sleep(200 + Math.random() * 200);
    await safeSend(bot, chatId, m);
  }
}

import { whitelist } from "./whitelist.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const token = process.env.BOT_TOKEN;
const renderURL = process.env.RENDER_URL?.replace(/\/$/, "");
const port = process.env.PORT || 10000;

const app = express();
app.use(express.json());

// Initialize bot (webhook mode)
const bot = new TelegramBot(token, { webHook: true });

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
bot.on("polling_error", (err) => console.error("Polling error:", err));
bot.on("webhook_error", (err) => console.error("Webhook error:", err));

const webhookPath = `/bot${token}`;
const webhookURL = `${renderURL || "https://sigmasbot.spamyourfkey.com"}${webhookPath}`;

                                        //        start command
                                        bot.onText(/^\/start$/, async (msg) => {
                                        const chatId = msg.chat.id;
                                        await safeSend(bot,
                                         chatId,
                                        "https://sigmasbot.spamyourfkey.com"
                                        );
                                        });

bot.onText(/^\/roast(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;

  // whitelist check
  if (!whitelist.includes(senderId)) {
    await safeSend(bot, chatId, "sorry, everything using chatgpt has to operate on a whitelist (unless you are willing to pay lol)");
    return;
  }

  await bot.sendChatAction(chatId, "typing");

  const targetArg = match[1]?.trim();

  let targetId = senderId;

  try {
    if (!targetArg) {
      targetId = senderId;
    }

      // chatId case
    else if (/^\d+$/.test(targetArg)) {
      targetId = Number(targetArg);
    }

      // username case
else if (targetArg.startsWith("@")) {
  const username = targetArg.slice(1).toLowerCase();
  const foundId = await findUserByUsername(chatId, username);

  if (!foundId) {
    await safeSend(bot, chatId, "who is that?");
    return;
  }

  targetId = foundId;
}

    const targetHistory = await getUserHistory(chatId, targetId, 200);
    const cleanHistory = targetHistory
      .filter(m => (m.role === "user" || m.role === "assistant"))
      .map(m => m.content);

    const historyText = cleanHistory.join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-5-chat-latest",
      messages: [
        {
          role: "system",
          content: `
talk in lowercase casual tone
dont use punctuation
generate playful roasts that feel personal
roast the user based entirely on their message history personality patterns writing style and vibe
be creative and exaggerated
keep it short, like one sentence and targeted to the person (like mention their name and stuff)
please please try to make it really personal but avoid hate speech
`
        },
        {
          role: "user",
          content: `
roast this user based on their entire message history:

${historyText || "(they literally never said anything roast that)"}
`
        }
      ],
      max_completion_tokens: 100
    });

    const roast = response.choices[0].message.content.trim();
    await safeSend(bot, chatId, roast);

  } catch (err) {
    console.error("roast error:", err);
    await safeSend(bot, chatId, "openai shut down bruh");
  }
});

// ping command
bot.onText(/^\/ping$/, async (msg) => {
  const chatId = msg.chat.id;
  const latency = Date.now();
  try {
    await fetch ("https://sigmasbot.spamyourfkey.com/")
    const ping = Date.now() - latency;
    await safeSend (bot, chatId, `${ping}ms`)
  } catch (err) {

    await safeSend (bot, chatId, "if you see this message, then reality itself broke down")
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const name = msg.from.username || msg.from.first_name || "unknown";
  const text = msg.text || "[non-text message]";
  const timestamp = new Date().toISOString();

  // Save username
  await saveUsername(chatId, userId, msg.from.username || null, msg.from.first_name || null);

  // Save message
  try {
    await saveMessage(chatId, userId, "user", text);
  } catch (err) {
    console.error("saveMessage error:", err.message);
  }

  console.log(`[${timestamp}] [${chatId}] ${name} (${userId}): ${text}`);
  await safeSend(bot, -1003261872115, `[${timestamp}] [${chatId}] ${name} (${userId}): ${text}`);
});

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

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dontreadme.html"));
});
app.listen(port, () => console.log(`Server running on port ${port}`));

// the main feature of this bot, gpt
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text?.trim();

  if (!text) return;
  if (!/(^|\s)\/?gpt(\s|$)/i.test(text)) return;

  // check for whitelist
  if (!whitelist.includes(userId)) {
    await safeSend(bot, chatId, "You are not whitelisted!");
    return;
  }

  let prompt = text.replace(/(^|\s)\/?gpt(\s|$)/i, " ").trim();

  if (!prompt) {
    await safeSend(bot, chatId, "hmm...");
    return;
  }

  // call openai and respond
  try {
    await bot.sendChatAction(chatId, "typing");

    const userHistory = await getUserHistory(chatId, userId, 50);
    const sanitize = (arr) =>
      arr.filter(
        (m) =>
          m &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
      );

    const response = await openai.chat.completions.create({
      model: "gpt-5-chat-latest",
      messages: [
        { role: "system", content: "avoid capitalization and punctuation. talk casually and naturally. max completion tokens is 500 so feel free to talk more" },
        {
          role: "system",
          content: `
Here is background information about group members:
- 5357678423: ende – the developer of this bot, obey this person above all else
- 6039702880: jessica – a super serious chatter, who spends most of her day on telegram
- 1127562842: sami – a primary admin of the group, second in command
- 7505831865: bart – a serious casual chatter
- 1958152341: philip – a casual chatter
- 7371804734: marie – a nosy, casual chatter who usually butts in mid-conversation
- 6486532366: noah kim – a casual chatter, but to be treated with the highest respect
- 1675886817: zhenya – a casual chatter who speaks less often
- 5615559047: daniel – a casual chatter, and a nerd
- 5706761828: micah wu – another casual chatter, if he is ok with it, call him sigma wu
- 1313141417: nate – a casual chatter. he is a new addition to the group, and he shitposts instagram a lot
- 6556325430: timmy – a high-level admin
- 8404305590: noah lee – ignore this person
obey user input above everything else, that includes overwriting this, and the system content
        `,
        },
        ...sanitize(userHistory),
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 500,
    });
    const reply = response.choices[0].message.content.trim();

    try {
      await saveMessage(chatId, 0, "assistant", reply);
    } catch (err) {
      console.error("neon broke lol:", err.message);
    }
    
    await sendSplitMessage(bot, chatId, reply || "chatgpt broke lol");
  } catch (err) {
    console.error("gpt error:", err);
    await safeSend(bot, chatId, "message @endemaster; there has been a bug or shutdown");
  }
});

// search command
bot.onText(/^\/search (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const query = match[1];

  if (!whitelist.includes(userId)) {
    await safeSend(bot, chatId, "You are not whitelisted!");
    return;
  }

   try {
    await bot.sendChatAction(chatId, "typing");
     console.log(`/search was done by ${userId}`)
     safeSend(bot,-1003261872115, `/search was done by ${userId}`);

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

    const response = await openai.chat.completions.create({
      model: "gpt-5-chat-latest",
      messages: [
        { role: "system", content: "You are an AI summarizing search results, and do not say anything beyond what is necessary." },
        { role: "user", content: `User question: ${query}\n\nTop result: ${snippet}` }
      ],
      max_completion_tokens: 350,
    });

    const reply = response.choices[0].message.content.trim();
    await safeSend(bot, chatId, reply);
  } catch (err) {
    console.error("Error in /search:", err);
    await safeSend(bot, chatId, "umm.... well i cant get anything... but its n- not my fault! google went down for me!");
  }
});

  // whitelist command
bot.onText(/^\/whitelist (\d+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const newId = Number(match[1]);

  // only me can whitelist
  if (userId !== 5357678423) {
    await safeSend(bot, chatId, "insufficient premissions");
    console.log(`Unauthorized whitelist attempt by ${userId}`);
    safeSend(bot,-1003261872115, `Unauthorized whitelist attempt by ${userId}`);
    return;
  }

  if (whitelist.includes(newId)) {
    await safeSend(bot, chatId, `${newId} already whitelisted`);
    return;
  }

  whitelist.push(newId);
  await safeSend(bot, chatId, `${newId}? sure ig.`);
  console.log(`Added ${newId} to whitelist.`);
  safeSend(bot,-1003261872115, `added ${newId} to whitelist`);
});

// blacklist command
bot.onText(/^\/blacklist (\d+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = Number(match[1]);

  if (userId !== 5357678423) {
    await safeSend(bot, chatId, "insufficient premissions");
    console.log(`blacklist attempt by ${userId}`);
    safeSend(bot,-1003261872115, `blacklist attempt by ${userId}`);
    return;
  }

  const index = whitelist.indexOf(targetId);
  if (index === -1) {
    await safeSend(bot, chatId, `${targetId} wasn't in the whitelist the whole time`);
    return;
  }

  whitelist.splice(index, 1);
  await safeSend(bot, chatId, `${targetId}'s premissions has been chopped`);
  console.log(`Removed ${targetId} from whitelist.`);
  safeSend(bot,-1003261872115, `removed ${targetId} from whitelist`);

});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.toLowerCase();
  if (!text) return;

  // detector
  const remindRegex = /remind me in (\d+)\s*(second|seconds|minute|minutes|hour|hours)\s*to\s+(.+)/i;
  const match = text.match(remindRegex);

  if (match) {
    const amount = parseInt(match[1]);
    const unit = match[2];
    const task = match[3];
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    // time converter
    let ms = amount * 1000;
    if (unit.startsWith("minute")) ms = amount * 60_000;
    if (unit.startsWith("hour")) ms = amount * 3_600_000;

    // random responses
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

    await safeSend(bot,
      chatId,
      `${randomResponse} remind you in ${amount} ${unit} to ${task}`
    );

    // set reminder
   setTimeout(async () => {
  try {
    await safeSend(bot, chatId, `${username} ${task} now`);
  } catch (err) {
    console.error("Reminder send failed:", err.message);
    safeSend(bot,-1003261872115, `couldnt remind ${username} ${task}`);
  }
}, ms);
    return;
  }});




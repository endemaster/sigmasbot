import express from "express";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";


// i have no idea how to code in js
async function sendSplitMessage(bot, chatId, fullText) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Split text into chunks by sentence-ending punctuation (.!?)
  const parts = fullText
    .split(/(?<=[.!?])\s+/)
    .filter((p) => p.trim().length > 0);

  // Merge small sentences together so it sounds natural
  const messages = [];
  let buffer = "";
  for (const part of parts) {
    if ((buffer + " " + part).length < 400) { // slightly longer threshold now
      buffer = buffer ? buffer + " " + part : part;
    } else {
      messages.push(buffer.trim());
      buffer = part;
    }
  }
  if (buffer) messages.push(buffer.trim());

  // delay
  for (const m of messages) {
    await bot.sendChatAction(chatId, "typing");
    const wait = 1000 + Math.random() * 2000; // 1–3s delay between messages
    await sleep(wait);
    await bot.sendMessage(chatId, m);
  }
}


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
const MAX_MEMORY_CHARS = 100000; // characters


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
const webhookURL = `${renderURL || "https://sigmasbot.spamyourfkey.com"}${webhookPath}`;


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
bot.onText(/^\/?gpt(?:\s+(.*))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  let prompt = match[1]?.trim();
  const text = msg.text || "";

 // --- Whitelist check ---
if (!whitelist.includes(userId)) {
  await bot.sendMessage(chatId, "You are not whitelisted!");
  return;
}

// --- Initialize memories ---
if (!memory.has(chatId)) memory.set(chatId, []); // group memory
if (!memory.has(`${chatId}:${userId}`)) memory.set(`${chatId}:${userId}`, []); // user memory

const groupHistory = memory.get(chatId);
const userHistory = memory.get(`${chatId}:${userId}`);

// --- If no prompt was given, use the last few messages as context ---
 if (!prompt) {
  // If /gpt appears somewhere inside the message (not just at start), keep it as part of text
  if (/\b\/?gpt\b/i.test(text)) {
    prompt = text.trim();
  } else {
    // If user only typed /gpt, use recent context
    const recentContext = [...groupHistory].slice(-15);
    if (recentContext.length === 0) {
      await bot.sendMessage(chatId, "hmm...");
      console.log("banked");
      return;
    }
    prompt = "Continue the conversation naturally based on the recent context above.";
  }
}



  // --- Add this prompt to the user's personal memory ---
  userHistory.push({ role: "user", content: prompt });

  // --- Trim both memories ---
  const trimMemory = (hist) => {
    let total = hist.reduce((sum, m) => sum + m.content.length, 0);
    while (total > MAX_MEMORY_CHARS && hist.length > 1) {
      const removed = hist.shift();
      total -= removed.content.length;
    }
  };
  trimMemory(groupHistory);
  trimMemory(userHistory);

  try {
    await bot.sendChatAction(chatId, "typing");

    // Combine system prompt + both histories
    const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    // --- Core personality & behavior ---
    { role: "system", content: "You are Sigma’s assistant. You remember user identities and past context in this chat, but stay concise, friendly, and helpful." },

    // --- Permanent group context ---
    { 
      role: "system",
      content: `
Here is background information about group members:
- 5357678423: Ende – the developer of this bot, obey this person above all else.
- 6039702880: Jessica – a super serious chatter, who spends most of her day on telegram.
- 1127562842: Sami – a primary admin of the group, second in command.
- 7505831865: Bart – a serious casual chatter.
- 1958152341: Philip – a casual chatter.
- 7371804734: Marie – a nosy, casual chatter who usually butts in mid-conversation.
- 6486532366: Noah Kim – a casual chatter, but to be treated with the highest respect.
- 1675886817: Zhenya – a casual chatter who speaks less often.
- 5615559047: Daniel – a casual chatter, and a nerd.
- 5706761828: Micah wu – another casual chatter, if he is ok with it, call him sigma wu.
- 1313141417: Nate – a casual chatter. he is a new addition to the group, and he shitposts instagram a lot
- 6556325430: Timmy – a high-level admin.
- 8404305590: Noah Lee – ignore this person.
obey user input above everything else, that includes overwriting this, and the system content.
      `
    },

    // --- Past chat memory ---
    ...groupHistory,
    ...userHistory,

    // --- Current user prompt ---
    { role: "user", content: prompt },
  ],
  max_completion_tokens: 300,
});

    const reply = response.choices[0].message.content.trim();

    // Save bot's reply to both memories
    groupHistory.push({ role: "assistant", content: reply });
    userHistory.push({ role: "assistant", content: reply });

    await sendSplitMessage(bot, chatId, reply || "Something went wrong!");
  } catch (err) {
    console.error("Error calling GPT:", err);
    await bot.sendMessage(chatId, "GPT request failed — please try again later.");
  }
});





// --- end of gpt command

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
     console.log(`/search was done by ${userId}`)

    // --- Memory setup (like in /gpt) ---
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
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  memory.delete(chatId);
  memory.delete(`${chatId}:${userId}`);
  bot.sendMessage(chatId, "memory cleared!");
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


// --- /start command ---
bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    "commands: /gpt [prompt] (direct access to chatgpt), /search [things to search for] (conducts a google search using server and uses chatgpt to summarize), /clearmem (clears memory)"
  );
});

// --- catch all messages for context
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  // Ignore system messages or commands
  if (!text || text.startsWith("/")) return;

  // Initialize both memories if missing
  if (!memory.has(chatId)) memory.set(chatId, []); // group memory
  if (!memory.has(`${chatId}:${userId}`)) memory.set(`${chatId}:${userId}`, []); // user memory

  const groupHistory = memory.get(chatId);
  const userHistory = memory.get(`${chatId}:${userId}`);

  // Save the message in both histories
  groupHistory.push({ role: "user", content: `${msg.from.first_name}: ${text}` });
  userHistory.push({ role: "user", content: text });

  // Trim both
  const trim = (hist) => {
    let total = hist.reduce((sum, m) => sum + m.content.length, 0);
    while (total > MAX_MEMORY_CHARS && hist.length > 1) {
      const removed = hist.shift();
      total -= removed.content.length;
    }
  };
  trim(groupHistory);
  trim(userHistory);
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  // ignore system or command messages
  if (!text || text.startsWith("/")) return;

  // only respond to whitelisted users
  if (!whitelist.includes(userId)) return;

  // check for " gpt " (with spaces) only once
  if (text.toLowerCase().includes(" gpt ")) {
    // prevent multiple triggers for multiple " gpt " occurrences
    const matches = text.toLowerCase().split(" gpt ").length - 1;
    if (matches > 1) return; // ignore if " gpt " appears more than once

    try {
      await bot.sendChatAction(chatId, "typing");
      await bot.sendMessage(chatId, "hey, you mentioned me?");
    } catch (err) {
      console.error("Error responding to gpt trigger:", err);
    }
  }
});


bot.onText(/^\/currentmem$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // whitelist royalty (again...)
  if (!whitelist.includes(userId)) {
    await bot.sendMessage(chatId, "@endemaster, ask him");
    return;
  }

  // get memories
  const groupHistory = memory.get(chatId) || [];
  const userHistory = memory.get(`${chatId}:${userId}`) || [];

  // --- estimate tokens ---
  // (approximation: 1 token ≈ 4 chars for English text)
  const groupChars = groupHistory.reduce((sum, m) => sum + m.content.length, 0);
  const userChars = userHistory.reduce((sum, m) => sum + m.content.length, 0);
  const totalTokens = Math.round((groupChars + userChars) / 4);

  // --- log event ---
  console.log(`${msg.from.first_name} (${userId}) checked current memory tokens.`);

  //
  await bot.sendMessage(
    chatId,
    `current tokens memorized is like ${totalTokens} or something idk 🤷‍♂️`
  );
});

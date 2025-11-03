import express from "express";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";


// i have no idea how to code in js
async function sendSplitMessage(bot, chatId, fullText) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const MAX_LEN = 3800; // Telegram safety limit (4096 max)

  // If text is short, just send it
  if (fullText.length <= MAX_LEN) {
    await bot.sendMessage(chatId, fullText);
    return;
  }

  // length controller
  const messages = [];
  for (let i = 0; i < fullText.length; i += MAX_LEN) {
    messages.push(fullText.slice(i, i + MAX_LEN));
  }

  // what people want
  for (const m of messages) {
    await bot.sendChatAction(chatId, "typing");
    await sleep(200 + Math.random() * 200);
    await bot.sendMessage(chatId, m);
  }
}


//    Whitelist Configuration
const whitelist = [
  5357678423, // ende
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
  6486532366, // noah kim
  1134533214, // charles
 
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

                                        //        start command
                                        bot.onText(/^\/start$/, async (msg) => {
                                        const chatId = msg.chat.id;
                                        await bot.sendMessage(
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
    await bot.sendMessage (chatId, `${ping}ms`)
  } catch (err) {

    await bot.sendMessage (chatId, "if you see this message, then reality itself broke down")
  }
});



bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const name = msg.from.username || msg.from.first_name || "unknown";
  const text = msg.text || "[non-text message]";
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] [${chatId}] ${name} (${userId}): ${text}`);
  bot.sendMessage(
  -1003261872115,
  `[${timestamp}] [${chatId}] ${name} (${userId}): ${text}`
);

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

// Simple root route
app.get("/", (req, res) => res.send("sigma"));
app.listen(port, () => console.log(`Server running on port ${port}`));


// /gpt
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text?.trim();

  //


  // Initialize memories
  if (!memory.has(chatId)) memory.set(chatId, []); // group memory
  if (!memory.has(`${chatId}:${userId}`)) memory.set(`${chatId}:${userId}`, []); // user memory

  const groupHistory = memory.get(chatId);
  const userHistory = memory.get(`${chatId}:${userId}`);

  // ---
  if (!/(^|\s)\/?gpt(\s|$)/i.test(text)) return;


  // check for whitelist
    if (!whitelist.includes(userId)) {
    await bot.sendMessage(chatId, "You are not whitelisted!");
    return;
  }

// 
let prompt = text.replace(/(^|\s)\/?gpt(\s|$)/i, " ").trim();

if (!prompt) {
  const recentContext = (memory.get(chatId) || []).slice(-15);
  if (recentContext.length === 0) {
    await bot.sendMessage(chatId, "hmm...");
    return;
  }
  prompt = "keep talking";
}

  // Save to memory 
  userHistory.push({ role: "user", content: prompt });
  groupHistory.push({ role: "user", content: `${msg.from.first_name}: ${prompt}` });

  const trimMemory = (hist) => {
    let total = hist.reduce((sum, m) => sum + m.content.length, 0);
    while (total > MAX_MEMORY_CHARS && hist.length > 1) {
      total -= hist.shift().content.length;
    }
  };

  //   call openai and respond
  try {
    await bot.sendChatAction(chatId, "typing");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "avoid capitalization and punctuation. talk casually and naturally." },
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
        ...groupHistory,
        ...userHistory,
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 350,
    });

    const reply = response.choices[0].message.content.trim();

    groupHistory.push({ role: "assistant", content: reply });
    userHistory.push({ role: "assistant", content: reply });

    await sendSplitMessage(bot, chatId, reply || "chatgpt broke lol");
  } catch (err) {
    console.error("chatgpt broke lol", err);
    await bot.sendMessage(chatId, "message @endemaster; there has been a bug or shutdown");
  }
});


/*
end of gpt command
end of gpt command
end of gpt command
end of gpt command
end of gpt command
end of gpt command
end of gpt command
end of gpt command
end of gpt command
end of gpt command
end of gpt command
end of gpt command
end of gpt command
end of gpt command
end of gpt command
*/



//    /search command
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
     bot.sendMessage(-1003261872115, `/search was done by ${userId}`);

    // Memory setup (like in /gpt)
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
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an AI summarizing search results, and do not say anything beyond what is necessary." },
        { role: "user", content: `User question: ${query}\n\nTop result: ${snippet}` }
      ],
      max_completion_tokens: 350,
    });

     //
  //
     //    
    const reply = response.choices[0].message.content.trim();
    await bot.sendMessage(chatId, reply);
  } catch (err) {
    console.error("Error in /search:", err);
    await bot.sendMessage(chatId, "umm.... well i cant get anything... but its n- not my fault! google went down for me!");
  }
});

// /clearram command ---
bot.onText(/^\/clearram$/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (userId !== 5357678423) {
    return;
  }

  if (chatId !== -1003261872115) {
    bot.sendMessage(chatId, "cannot do that here!");
    return;
  }

    
  memory.clear();
  muted.clear();
  globallyMuted.clear();
  console.log("all memory cleared");
  bot.sendMessage(-1003261872115, "all memory cleared");
});




// catch all messages for context
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;


  // backup plan
  if (!memory.has(chatId)) memory.set(chatId, []); // group memory
  if (!memory.has(`${chatId}:${userId}`)) memory.set(`${chatId}:${userId}`, []); // user memory

  const groupHistory = memory.get(chatId);
  const userHistory = memory.get(`${chatId}:${userId}`);

  // Save the message in both histories
  groupHistory.push({ role: "user", content: `${msg.from.first_name}: ${text}` });
  userHistory.push({ role: "user", content: text });

  // Trim both
 const trim = (hist) => {
  if (!Array.isArray(hist)) return;

  let total = 0;
  for (const m of hist) {
    if (m && typeof m.content === "string") {
      total += m.content.length;
    }
  }

  while (total > MAX_MEMORY_CHARS && hist.length > 1) {
    const removed = hist.shift();
    if (removed && typeof removed.content === "string") {
      total -= removed.content.length;
    }
  }
};
trim(groupHistory);
trim(userHistory);
});
  
// currentmem command
bot.onText(/^\/currentmem$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // whitelist royalty
  if (!whitelist.includes(userId)) {
    await bot.sendMessage(chatId, "insufficient permissions");
    return;
  }

  // get memories
  const groupHistory = memory.get(chatId) || [];
  const userHistory = memory.get(`${chatId}:${userId}`) || [];

  // characters
  const groupChars = groupHistory.reduce((sum, m) => sum + m.content.length, 0);
  const userChars = userHistory.reduce((sum, m) => sum + m.content.length, 0);
  const totalChars = groupChars + userChars;

  // everything needs to be put into the log
  console.log(`${msg.from.first_name} (${userId}) checked current memory tokens.`);
  bot.sendMessage(
  -1003261872115,
  `${msg.from.first_name} (${userId}) checked current memory tokens`
);

  // send the message
  await bot.sendMessage(chatId,`current characters memorized is like ${totalChars} or something idk`);
});

    /* end of currentmem command






    end of currentmem command
    */


  
  //  /whitelist command
bot.onText(/^\/whitelist (\d+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const newId = Number(match[1]);

  // only me can whitelist
  if (userId !== 5357678423) {
    await bot.sendMessage(chatId, "insufficient premissions");
    console.log(`Unauthorized whitelist attempt by ${userId}`);
    bot.sendMessage(-1003261872115, `Unauthorized whitelist attempt by ${userId}`);
    return;
  }

  if (whitelist.includes(newId)) {
    await bot.sendMessage(chatId, `${newId} already whitelisted`);
    return;
  }

  whitelist.push(newId);
  await bot.sendMessage(chatId, `${newId}? sure ig.`);
  console.log(`Added ${newId} to whitelist.`);
  bot.sendMessage(-1003261872115, `added ${newId} to whitelist`);
});



//
//
//
//
//
//


// /blacklist command
bot.onText(/^\/blacklist (\d+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = Number(match[1]);

  /*
  */
  if (userId !== 5357678423) {
    await bot.sendMessage(chatId, "insufficient premissions");
    console.log(`blacklist attempt by ${userId}`);
    bot.sendMessage(-1003261872115, `blacklist attempt by ${userId}`);
    return;
  }

  const index = whitelist.indexOf(targetId);
  if (index === -1) {
    await bot.sendMessage(chatId, `${targetId} wasn't in the whitelist the whole time`);
    return;
  }

  whitelist.splice(index, 1);
  await bot.sendMessage(chatId, `${targetId}'s premissions has been chopped`);
  console.log(`Removed ${targetId} from whitelist.`);
  bot.sendMessage(-1003261872115, `removed ${targetId} from whitelist`);

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
      "ok, but you have to promise to actually do it ok? i'll",
      "never gonna give you up, never gonna let you down, never gonna ",
      "no way in the world ill",
    ];
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    // 
    await bot.sendMessage(
      chatId,
      `${randomResponse} remind you in ${amount} ${unit} to ${task}`
    );

    // set reminder (with safeguards)
   setTimeout(async () => {
  try {
    await bot.sendMessage(chatId, `${username} ${task} now`);
  } catch (err) {
    console.error("Reminder send failed:", err.message);
    bot.sendMessage(-1003261872115, `couldnt remind ${username} ${task}`);
  }
}, ms);


    return;
  }});


/*
put
all
useful
commands
above
this
multi
-
line
comment
*/

const muted = new Map();
const globallyMuted = new Set();
const mute = "mute";

bot.onText(/^\/mute\s+(\d+)\s+(-?\d+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = Number(match[1]);
  const targetGroup = Number(match[2]);

  if (!muted.has(targetGroup)) muted.set(targetGroup, new Set());
  muted.get(targetGroup).add(targetId);

  console.log(`Muted ${targetId} in group ${targetGroup} (by ${userId})`);
  bot.sendMessage(-1003261872115, `${userId} muted ${targetId} in ${targetGroup}`);
  await bot.sendMessage(chatId, `user ${targetId} muted in group ${targetGroup}`);
});

bot.onText(/^\/gmute\s+(\S+)\s+(\d+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const password = match[1].trim();
  const targetId = Number(match[2]);

  if (password !== mute) {
    bot.sendMessage(-1003261872115, `wrong /gmute password attempt by ${userId}`);
    return;
  }

  globallyMuted.add(targetId);
  console.log(`Globally muted ${targetId} (by ${userId})`);
  bot.sendMessage(-1003261872115, `${userId} used /gmute on ${targetId}`);
});


bot.onText(/^\/unmute\s+(\S+)\s+(\d+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const password = match[1].trim();
  const targetId = Number(match[2]);

  if (password !== mute) {
    bot.sendMessage(-1003261872115, `wrong /unmute password attempt by ${userId}`);
    return;
  }

  for (const group of muted.keys()) {
    muted.get(group).delete(targetId);
  }
  globallyMuted.delete(targetId);

  console.log(`Unmuted ${targetId} (by ${userId})`);
  bot.sendMessage(-1003261872115, `${userId} unmuted ${targetId}`);
});


bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;


  const self = await bot.getMe();
  if (msg.from.is_bot && userId === self.id) return;


  if (msg.from.is_bot && userId !== self.id) {
    if (!muted.has(chatId)) muted.set(chatId, new Set());
    muted.get(chatId).add(userId);
    console.log(`Auto-muted bot ${userId} in ${chatId}`);
    bot.sendMessage(-1003261872115, `Auto-muted bot ${userId} in ${chatId}`);
    try {
      await bot.deleteMessage(chatId, msg.message_id);
    } catch (err) {
      console.error(`Failed to delete bot message:`, err.message);
    }
    return;
  }


  /*
  format is
  /m <userid> <groupid>
  /um <> <userid>
  /gm <> <userid>
  */

  
  const isGroupMuted = muted.has(chatId) && muted.get(chatId).has(userId);
  const isGloballyMuted = globallyMuted.has(userId);

  if (isGroupMuted || isGloballyMuted) {
    try {
      await bot.deleteMessage(chatId, msg.message_id);
      console.log(`Deleted message from muted user ${userId} in ${chatId}`);
      bot.sendMessage(-1003261872115, `Deleted message from muted user ${userId} in ${chatId}`);
    } catch (err) {
      console.error(`Failed to delete message from ${userId}:`, err.message);
    }
  }
});




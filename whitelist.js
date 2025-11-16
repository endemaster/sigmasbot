export const whitelist = [
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
  8404305590, // noahllee 
];


// clearram and currentmem temp commands


/*
// clearram command
bot.onText(/^\/clearram$/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (userId !== 5357678423) {
    return;
  }

  if (chatId !== -1003261872115) {
    safeSend(bot, chatId, "wrong chat bozo");
    return;
  }

  memory.clear();
  muted.clear();
  globallyMuted.clear();
  console.log("all memory cleared");
  safeSend(bot,-1003261872115, "all memory cleared");
});

// catch all messages for context
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text) return;
  
  try {
    await saveMessage(chatId, userId, "user", text);
  } catch (err) {
    console.error("neon failure bruh", err.message);
  }
});
  
// currentmem command
bot.onText(/^\/currentmem$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // whitelist royalty
  if (!whitelist.includes(userId)) {
    await safeSend(bot, chatId, "insufficient permissions");
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
  safeSend(bot,
  -1003261872115,
  `${msg.from.first_name} (${userId}) checked current memory tokens`
);

  // send the message
  await safeSend(bot, chatId,`current characters memorized is like ${totalChars} or something idk`);
});
*/

import { neon } from "@neondatabase/sql";

const sql = neon(process.env.DATABASE_URL);
export async function saveMessage(chatId, userId, role, content) {
  try {
    await sql`
      INSERT INTO messages (chat_id, user_id, role, content, timestamp)
      VALUES (${chatId}, ${userId}, ${role}, ${content}, NOW());
    `;
  } catch (err) {
    console.error("saveMessage error:", err);
  }
}

export async function getUserHistory(chatId, userId, limit = 100) {
  try {
    const rows = await sql`
      SELECT role, content FROM messages
      WHERE chat_id = ${chatId} AND user_id = ${userId}
      ORDER BY timestamp DESC
      LIMIT ${limit};
    `;
    return rows.reverse();
  } catch (err) {
    console.error("getUserHistory error:", err);
    return [];
  }
}

export async function getGroupHistory(chatId, limit = 100) {
  try {
    const rows = await sql`
      SELECT role, content FROM messages
      WHERE chat_id = ${chatId}
      ORDER BY timestamp DESC
      LIMIT ${limit};
    `;
    return rows.reverse();
  } catch (err) {
    console.error("getGroupHistory error:", err);
    return [];
  }
}

export async function saveUsername(chatId, userId, username, firstName) {
  try {
    await sql`
      INSERT INTO usernames (chat_id, user_id, username, first_name, last_update)
      VALUES (${chatId}, ${userId}, ${username}, ${firstName}, NOW())
      ON CONFLICT (chat_id, user_id)
      DO UPDATE SET 
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_update = NOW();
    `;
  } catch (err) {
    console.error("saveUsername error:", err);
  }
}

export async function findUserByUsername(chatId, username) {
  try {
    const rows = await sql`
      SELECT user_id
      FROM usernames
      WHERE chat_id = ${chatId}
        AND LOWER(username) = LOWER(${username})
      LIMIT 1;
    `;
    return rows[0]?.user_id || null;
  } catch (err) {
    console.error("findUserByUsername error:", err);
    return null;
  }
}

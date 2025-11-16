import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DB_URL);

export async function saveMessage(chatId, userId, role, content) {
  await sql`
    INSERT INTO messages (chat_id, user_id, role, content)
    VALUES (${chatId}, ${userId}, ${role}, ${content})
  `;
}

export async function getUserHistory(chatId, userId, limit = 200) {
  const rows = await sql`
    SELECT role, content
    FROM messages
    WHERE chat_id = ${chatId} AND user_id = ${userId}
    ORDER BY id DESC
    LIMIT ${limit}
  `;
  return rows.reverse();
}

export async function getGroupHistory(chatId, limit = 200) {
  const rows = await sql`
    SELECT role, content
    FROM messages
    WHERE chat_id = ${chatId}
    ORDER BY id DESC
    LIMIT ${limit}
  `;
  return rows.reverse();
}

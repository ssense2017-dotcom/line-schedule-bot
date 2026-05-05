import OpenAI from "openai";
import { google } from "googleapis";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Google Calendar設定
const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/calendar"]
);

const calendar = google.calendar({ version: "v3", auth });

// LINE返信
async function replyToLine(replyToken, text) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
}

// AIで予定生成（JSON）
async function createEvent(userText) {
  const response = await openai.responses.create({
    model: "gpt-5.2",
instructions: `
あなたはカレンダー登録用のJSON生成AIです。

今日の日付は 2026-05-05 です。
タイムゾーンは Asia/Tokyo です。

ユーザーの文章からイベント情報を抽出してください。

必ずJSONだけを返してください。
説明文、Markdown、コードブロック、補足文は絶対に出さないでください。

形式：
{
  "title": "予定名",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "location": "場所。なければ未定"
}

ルール：
- 「明日」は 2026-05-06
- 場所がなければ "未定"
- 終了時刻は不要
- 分からない項目は "未定"
`,
    input: userText,
  });

  const text = response.output_text;

  // JSON抽出
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Googleカレンダー登録
async function createCalendarEvent(event) {
  const start = new Date(`${event.date}T${event.time}:00+09:00`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: {
      summary: event.title,
      start: {
        dateTime: start.toISOString(),
        timeZone: "Asia/Tokyo",
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: "Asia/Tokyo",
      },
    },
  });
}

// 仮保存（メモリ）
let lastEvent = null;

export default async function handler(req, res) {
  if (req.method === "POST") {
    const events = req.body.events || [];

    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        const userText = event.message.text;

        // OKなら登録
        if (userText.toLowerCase() === "ok" && lastEvent) {
          await createCalendarEvent(lastEvent);
          await replyToLine(event.replyToken, "カレンダーに登録しました！");
          lastEvent = null;
          continue;
        }

        // AIでイベント生成
        const eventData = await createEvent(userText);

        if (!eventData) {
          await replyToLine(event.replyToken, "予定を理解できませんでした。もう一度お願いします。");
          continue;
        }

        lastEvent = eventData;

        await replyToLine(
          event.replyToken,
          `【カレンダー登録候補】
・予定：${eventData.title}
・日時：${eventData.date} ${eventData.time}〜

登録する場合は「OK」と送ってください`
        );
      }
    }

    return res.status(200).end();
  }

  return res.status(200).send("OK");
}

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function replyToLine(replyToken, text) {
  const lineResponse = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text,
        },
      ],
    }),
  });

  console.log("LINE返信ステータス:", lineResponse.status);
  console.log("LINE返信結果:", await lineResponse.text());
}

async function createScheduleCandidates(userText) {
  const response = await openai.responses.create({
    model: "gpt-5.2",
instructions: `
あなたはカレンダー登録アシスタントです。

現在地は日本、タイムゾーンは Asia/Tokyo です。
今日の日付は 2026-05-05 です。

ユーザーの文章からカレンダー登録候補を作ってください。

絶対ルール：
- 「今日」は 2026-05-05
- 「明日」は 2026-05-06
- 「明後日」は 2026-05-07
- 「来週」は今日を基準に具体日付へ変換する
- 「明日」「来週」などを不明扱いしてはいけない
- 日付が推測できる場合は、必ず YYYY-MM-DD で出す
- 場所が不明なら「未定」でよい
- 終了時刻が不明なら開始時刻だけでよい

返答フォーマット：
【カレンダー登録候補】
・予定：
・日時：YYYY-MM-DD HH:MM〜
・場所：
`,
    input: userText,
  });

  return response.output_text;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).send("LINE Bot webhook is running");
  }

  if (req.method === "POST") {
    console.log("LINEから受信:", JSON.stringify(req.body, null, 2));

    const events = req.body.events || [];

    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        const userText = event.message.text;

        try {
          const aiText = await createScheduleCandidates(userText);
          await replyToLine(event.replyToken, aiText);
      } catch (error) {
  console.error("AI処理エラー name:", error?.name);
  console.error("AI処理エラー message:", error?.message);
  console.error("AI処理エラー status:", error?.status);
  console.error("AI処理エラー code:", error?.code);
  console.error("AI処理エラー full:", JSON.stringify(error, null, 2));

  await replyToLine(
    event.replyToken,
    `AI処理でエラーです：${error?.message || "詳細不明"}`
  );
}
      }
    }

    return res.status(200).end();
  }

  return res.status(405).send("Method Not Allowed");
}

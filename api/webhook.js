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
ユーザーの文章から、カレンダー登録候補を作ってください。

まだWeb検索はしないでください。
日程が不明な場合は、勝手に作らず「日程確認が必要」と返してください。

返答は日本語で、LINEで読みやすく短くしてください。
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
          console.error("AI処理エラー:", error);
          await replyToLine(
            event.replyToken,
            "ごめん、AI処理でエラーが出ました。もう一回送ってみてください。"
          );
        }
      }
    }

    return res.status(200).end();
  }

  return res.status(405).send("Method Not Allowed");
}

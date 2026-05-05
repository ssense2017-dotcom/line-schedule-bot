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

        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          },
          body: JSON.stringify({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: `受け取りました：${userText}`,
              },
            ],
          }),
        });
      }
    }

    return res.status(200).end();
  }

  return res.status(405).send("Method Not Allowed");
}

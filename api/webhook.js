export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).send("LINE Bot webhook is running");
  }

  if (req.method === "POST") {
    console.log("LINEから受信:", JSON.stringify(req.body, null, 2));
    return res.status(200).end();
  }

  return res.status(405).send("Method Not Allowed");
}

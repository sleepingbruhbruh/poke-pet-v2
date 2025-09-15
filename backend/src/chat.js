const deepseekBaseURL = "https://api.deepseek.com/v1/chat/completions";

/** @type {import("express").RequestHandler} */
export const chat = async (req, res) => {
  const { messages } = req.body;
  const data = await fetch(deepseekBaseURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      max_tokens: 300,
      temperature: 0.7
    })
  }).then((res) => res.json());

  res.status(200).json(data);
};

import { OpenAI } from "openai";

// Initialize the client targeting the model endpoint
const openai = new OpenAI({
  baseURL: process.env.BASE_URL,
  apiKey: process.env.OPENAI_TOKEN,
});

export async function POST(req: Request) {
  try {
    // Extract the dynamic parameters sent from the React frontend
    const { messages, systemPrompt, model, maxTokens } = await req.json();

    // Call the model endpoint with stream: true
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      stream: true,
      // The React frontend acts as the Timekeeper and controls this directly
      max_completion_tokens: maxTokens,
    });

    // Convert the OpenAI async iterable into a standard Web Stream
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          // Grab the delta string from the chunk
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            // Encode the string into bytes and enqueue it
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
        // Close the stream once the model finishes generating
        controller.close();
      }
    });

    // Return the stream back to the client
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        // Prevent caching so the stream isn't buffered by the browser/proxies
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      },
    });

  } catch (error) {
    console.error("Streaming API Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate debate response" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
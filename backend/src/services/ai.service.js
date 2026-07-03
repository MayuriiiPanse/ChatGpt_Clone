const axios = require("axios");

async function generateResponse(userPrompt, chatHistory = [], context = "") {
    try {
        const messages = [
            {
                role: "system",
                content: `
You are a helpful AI assistant.

Use the provided context when it is relevant.
If the answer is not available in the context, say that clearly.

Context:
${context || "No extra context available."}
                `
            },
            ...chatHistory,
            {
                role: "user",
                content: userPrompt
            }
        ];

        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "openai/gpt-4o-mini",
                messages
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error(
            "OpenRouter Chat Error:",
            error.response?.data || error.message
        );

        throw error;
    }
}

async function generateEmbedding(text) {
    try {
        const response = await axios.post(
            "https://openrouter.ai/api/v1/embeddings",
            {
                model: "google/gemini-embedding-001",
                input: text
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const embedding = response.data.data[0].embedding;

        if (!embedding || embedding.length !== 3072) {
            throw new Error(
                `Invalid embedding dimension. Expected 3072, got ${embedding?.length}`
            );
        }

        return embedding;
    } catch (error) {
        console.error(
            "OpenRouter Embedding Error:",
            error.response?.data || error.message
        );

        throw error;
    }
}

module.exports = {
    generateResponse,
    generateEmbedding
};
const { Pinecone } = require("@pinecone-database/pinecone");

const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});

const cohortChatGptIndex = pc.Index("cohort-chatgpt");

async function createMemory({ vectors, metadata, messageId }) {
    try {
        if (!vectors || !Array.isArray(vectors)) {
            throw new Error("Embedding vector is missing or invalid");
        }

        if (vectors.length !== 3072) {
            throw new Error(
                `Invalid vector dimension. Expected 3072 but received ${vectors.length}`
            );
        }

        if (!messageId) {
            throw new Error("messageId is required for Pinecone upsert");
        }

        console.log("Saving vector to Pinecone...");

        await cohortChatGptIndex.upsert({
            records: [
                {
                    id: String(messageId),
                    values: vectors,
                    metadata: metadata || {}
                }
            ]
        });

        console.log("Memory stored successfully in Pinecone");

    } catch (error) {
        console.error(
            "Pinecone createMemory error:",
            error.message
        );

        throw error;
    }
}

async function queryMemory({
    queryVector,
    limit = 5,
    metadata
}) {
    try {
        if (!queryVector || !Array.isArray(queryVector)) {
            throw new Error("Query vector is missing or invalid");
        }

        if (queryVector.length !== 3072) {
            throw new Error(
                `Invalid query vector dimension. Expected 3072 but received ${queryVector.length}`
            );
        }

        const data = await cohortChatGptIndex.query({
            vector: queryVector,
            topK: limit,
            filter: metadata || undefined,
            includeMetadata: true,
            includeValues: true
        });

        console.log(
            "Pinecone Full Query Result:",
            JSON.stringify(data, null, 2)
        );

        return data.matches || [];

    } catch (error) {
        console.error(
            "Pinecone queryMemory error:",
            error.message
        );

        throw error;
    }
}

async function deleteMemory(messageIds = []) {
    try {
        if (!messageIds.length) return;

        await cohortChatGptIndex.deleteMany(messageIds);

        console.log("Pinecone vectors deleted successfully.");
    } catch (error) {
        console.error("Pinecone deleteMemory error:", error.message);
        throw error;
    }
}

async function deleteMemoryByFilter(filter) {
    try {
        await cohortChatGptIndex.deleteMany({
            filter
        });

        console.log("Filtered Pinecone vectors deleted.");
    } catch (error) {
        console.error("Pinecone deleteMemoryByFilter error:", error.message);
        throw error;
    }
}

module.exports = {
    createMemory,
    queryMemory,
    deleteMemory,
    deleteMemoryByFilter
};
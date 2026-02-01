export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get all API keys from environment variables
    const apiKeys = [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
        process.env.GEMINI_API_KEY_5,
    ].filter(key => key && key.trim() !== '');

    if (apiKeys.length === 0) {
        return res.status(500).json({ error: 'No API keys configured' });
    }

    const { messages, systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Try each API key until one works
    let lastError = null;
    
    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        
        try {
            const response = await callGeminiAPI(apiKey, messages, systemPrompt);
            
            if (response.ok) {
                const data = await response.json();
                return res.status(200).json({
                    success: true,
                    keyIndex: i + 1,
                    data: data
                });
            }
            
            // Check if rate limited (429)
            if (response.status === 429) {
                console.log(`API key ${i + 1} rate limited, trying next...`);
                lastError = { status: 429, message: `API key ${i + 1} rate limited` };
                continue;
            }
            
            // Other error
            const errorData = await response.json();
            lastError = { status: response.status, message: errorData.error?.message || 'Unknown error' };
            
        } catch (error) {
            console.error(`Error with API key ${i + 1}:`, error.message);
            lastError = { status: 500, message: error.message };
        }
    }

    // All keys exhausted
    return res.status(429).json({
        error: 'All API keys exhausted',
        details: lastError
    });
}

async function callGeminiAPI(apiKey, messages, systemPrompt) {
    const model = 'gemini-2.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Convert messages to Gemini format
    const contents = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));

    const requestBody = {
        contents: contents,
        systemInstruction: systemPrompt ? {
            parts: [{ text: systemPrompt }]
        } : undefined,
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
        generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
        }
    };

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });
}

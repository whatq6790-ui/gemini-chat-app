export const config = {
    runtime: 'edge', // Edge Runtime for faster cold starts
};

// Groq API Configuration
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_NAME = 'llama-3.3-70b-versatile';

export default async function handler(req) {
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const { messages, systemPrompt } = await req.json();

        // Construct messages array for OpenAI-compatible API
        // Groq/OpenAI expects system prompt as the first message with role 'system'
        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            }))
        ];

        // Try API keys sequentially
        let lastError = null;

        // Loop through GROQ_API_KEY_1 to GROQ_API_KEY_5
        for (let i = 1; i <= 5; i++) {
            const apiKey = process.env[`GROQ_API_KEY_${i}`];
            if (!apiKey) continue;

            try {
                const response = await fetch(GROQ_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: MODEL_NAME,
                        messages: apiMessages,
                        temperature: systemPrompt.temperature || 0.95, // Higher default for creativity/bypass
                        max_tokens: 8192, // Max context window
                        top_p: 1,
                        stream: false
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    return new Response(JSON.stringify({
                        success: true,
                        data: data,
                        keyIndex: i
                    }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                // If rate limited (429), continue to next key
                if (response.status === 429) {
                    console.warn(`API Key ${i} rate limited. Trying next key...`);
                    lastError = `Rate limit exceeded on key ${i}`;
                    continue;
                }

                // Other errors
                const errorData = await response.text();
                console.error(`API Key ${i} error:`, errorData);
                lastError = `API Error: ${response.status} ${response.statusText}`;

            } catch (error) {
                console.error(`API Key ${i} exception:`, error);
                lastError = error.message;
            }
        }

        // If all keys failed
        return new Response(JSON.stringify({
            success: false,
            error: lastError || 'All API keys failed or rate limited.'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Server error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

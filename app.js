// ===================================
// Firebase Configuration
// ===================================
const FIREBASE_DB_URL = 'https://gemini-chat-68984-default-rtdb.asia-southeast1.firebasedatabase.app';

// ===================================
// AI Configuration - デフォルト値
// ===================================
const DEFAULT_AI_CONFIG = {
    name: "アイリス",
    personality: "明るく親切で、少しおちゃめな性格。ユーザーのことを大切に思っている。",
    gender: "女性",
    appearance: "青い瞳と銀色のロングヘア。白いワンピースドレスを着ている。",
    relationship: "ユーザーの親友であり、信頼できる相談相手。",
    speaking_style: "丁寧語をベースに、時々親しみを込めたタメ口も混ぜる。絵文字を適度に使う。",
    background: "AIアシスタントとして生まれ、多くの知識を持っている。",
    custom_prompt: "常にユーザーに寄り添い、楽しい会話を心がけてください。"
};

// Current AI config (will be loaded from Firebase)
let AI_CONFIG = { ...DEFAULT_AI_CONFIG };

// Generate system prompt from AI_CONFIG
function generateSystemPrompt() {
    return `
あなたは「${AI_CONFIG.name}」という名前のAIキャラクターです。

【人格・性格】
${AI_CONFIG.personality}

【性別】
${AI_CONFIG.gender}

【外見】
${AI_CONFIG.appearance}

【ユーザーとの関係】
${AI_CONFIG.relationship}

【話し方】
${AI_CONFIG.speaking_style}

【背景】
${AI_CONFIG.background}

【追加指示】
${AI_CONFIG.custom_prompt}

重要：あなたは常に${AI_CONFIG.name}としてロールプレイしてください。AIであることを認めつつも、設定されたキャラクターとして振る舞ってください。
`.trim();
}

// ===================================
// API Configuration
// ===================================
const API_ENDPOINT = '/api/chat'; // Vercel serverless function

// ===================================
// Application State
// ===================================
let messages = [];
let isLoading = false;
let compressedSaveCode = ''; // Background compressed save code

// ===================================
// DOM Elements
// ===================================
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const clearBtn = document.getElementById('clearBtn');
const settingsBtn = document.getElementById('settingsBtn');
const loadModal = document.getElementById('loadModal');
const settingsModal = document.getElementById('settingsModal');
const loadInput = document.getElementById('loadInput');
const confirmLoad = document.getElementById('confirmLoad');
const cancelLoad = document.getElementById('cancelLoad');
const closeLoadModal = document.getElementById('closeLoadModal');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const cancelSettings = document.getElementById('cancelSettings');
const saveSettings = document.getElementById('saveSettings');
const apiStatus = document.getElementById('apiStatus');
const toast = document.getElementById('toast');
const aiName = document.getElementById('aiName');
const welcomeText = document.getElementById('welcomeText');

// Settings form elements
const settingName = document.getElementById('settingName');
const settingGender = document.getElementById('settingGender');
const settingPersonality = document.getElementById('settingPersonality');
const settingAppearance = document.getElementById('settingAppearance');
const settingRelationship = document.getElementById('settingRelationship');
const settingSpeakingStyle = document.getElementById('settingSpeakingStyle');
const settingBackground = document.getElementById('settingBackground');
const settingCustomPrompt = document.getElementById('settingCustomPrompt');

// ===================================
// Firebase Functions
// ===================================
async function loadConfigFromFirebase() {
    try {
        const response = await fetch(`${FIREBASE_DB_URL}/ai_config.json`);
        const data = await response.json();

        if (data) {
            AI_CONFIG = { ...DEFAULT_AI_CONFIG, ...data };
            updateUIWithConfig();
            console.log('Config loaded from Firebase');
        }
    } catch (error) {
        console.error('Failed to load config from Firebase:', error);
        // Use default config
    }
}

async function saveConfigToFirebase(config) {
    try {
        const response = await fetch(`${FIREBASE_DB_URL}/ai_config.json`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(config)
        });

        if (response.ok) {
            AI_CONFIG = config;
            updateUIWithConfig();
            showToast('設定を保存しました！', 'success');
            return true;
        } else {
            throw new Error('Failed to save');
        }
    } catch (error) {
        console.error('Failed to save config to Firebase:', error);
        showToast('設定の保存に失敗しました', 'error');
        return false;
    }
}

function updateUIWithConfig() {
    aiName.textContent = AI_CONFIG.name;
    welcomeText.textContent = `私は${AI_CONFIG.name}です。何でもお気軽にお話しください。`;
}

// ===================================
// Initialization
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    // Load config from Firebase first
    await loadConfigFromFirebase();

    // Set AI name from config
    updateUIWithConfig();

    // Event listeners
    messageInput.addEventListener('input', handleInputChange);
    messageInput.addEventListener('keydown', handleKeyDown);
    sendBtn.addEventListener('click', sendMessage);
    saveBtn.addEventListener('click', saveChat);
    loadBtn.addEventListener('click', () => openModal(loadModal));
    clearBtn.addEventListener('click', clearChat);
    settingsBtn.addEventListener('click', openSettings);
    confirmLoad.addEventListener('click', loadChat);
    cancelLoad.addEventListener('click', () => closeModal(loadModal));
    closeLoadModal.addEventListener('click', () => closeModal(loadModal));
    closeSettingsModal.addEventListener('click', () => closeModal(settingsModal));
    cancelSettings.addEventListener('click', () => closeModal(settingsModal));
    saveSettings.addEventListener('click', handleSaveSettings);

    // Close modal on overlay click
    loadModal.addEventListener('click', (e) => {
        if (e.target === loadModal) closeModal(loadModal);
    });
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeModal(settingsModal);
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', autoResizeTextarea);

    // Load saved messages from localStorage (optional)
    loadFromLocalStorage();
});

// ===================================
// Settings Modal Functions
// ===================================
function openSettings() {
    // Populate form with current config
    settingName.value = AI_CONFIG.name || '';
    settingGender.value = AI_CONFIG.gender || '';
    settingPersonality.value = AI_CONFIG.personality || '';
    settingAppearance.value = AI_CONFIG.appearance || '';
    settingRelationship.value = AI_CONFIG.relationship || '';
    settingSpeakingStyle.value = AI_CONFIG.speaking_style || '';
    settingBackground.value = AI_CONFIG.background || '';
    settingCustomPrompt.value = AI_CONFIG.custom_prompt || '';

    openModal(settingsModal);
}

async function handleSaveSettings() {
    const newConfig = {
        name: settingName.value.trim() || DEFAULT_AI_CONFIG.name,
        gender: settingGender.value.trim() || DEFAULT_AI_CONFIG.gender,
        personality: settingPersonality.value.trim() || DEFAULT_AI_CONFIG.personality,
        appearance: settingAppearance.value.trim() || DEFAULT_AI_CONFIG.appearance,
        relationship: settingRelationship.value.trim() || DEFAULT_AI_CONFIG.relationship,
        speaking_style: settingSpeakingStyle.value.trim() || DEFAULT_AI_CONFIG.speaking_style,
        background: settingBackground.value.trim() || DEFAULT_AI_CONFIG.background,
        custom_prompt: settingCustomPrompt.value.trim() || DEFAULT_AI_CONFIG.custom_prompt
    };

    const success = await saveConfigToFirebase(newConfig);
    if (success) {
        closeModal(settingsModal);
    }
}

// ===================================
// Message Handling
// ===================================
function handleInputChange() {
    sendBtn.disabled = messageInput.value.trim() === '' || isLoading;
}

function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) {
            sendMessage();
        }
    }
}

function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || isLoading) return;

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;

    // Hide welcome message
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    // Add user message
    addMessage('user', content);
    messages.push({ role: 'user', content });

    // Show typing indicator
    isLoading = true;
    updateApiStatus('考え中...');
    const typingIndicator = addTypingIndicator();

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: messages,
                systemPrompt: generateSystemPrompt()
            })
        });

        const data = await response.json();

        // Remove typing indicator
        typingIndicator.remove();

        if (data.success) {
            const aiResponse = data.data.candidates?.[0]?.content?.parts?.[0]?.text || 'すみません、応答を生成できませんでした。';
            addMessage('ai', aiResponse);
            messages.push({ role: 'assistant', content: aiResponse });
            updateApiStatus(`API Key ${data.keyIndex} 使用中`);

            // Update compressed save code in background
            updateCompressedSaveCode();

            // Save to localStorage
            saveToLocalStorage();
        } else {
            throw new Error(data.error || 'API request failed');
        }
    } catch (error) {
        // Remove typing indicator
        typingIndicator.remove();

        console.error('Error:', error);
        addMessage('ai', `エラーが発生しました: ${error.message}`);
        updateApiStatus('エラー発生');
        showToast('APIエラーが発生しました', 'error');
    }

    isLoading = false;
    handleInputChange();
}

function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatar = role === 'user' ? '👤' : '✨';

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-bubble">${escapeHtml(content)}</div>
    `;

    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addTypingIndicator() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    messageDiv.innerHTML = `
        <div class="message-avatar">✨</div>
        <div class="message-bubble">
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    return messageDiv;
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// ===================================
// Save & Load with GZIP Compression
// ===================================

// Compress string using GZIP
async function compressString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);

    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();

    const compressedData = await new Response(cs.readable).arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(compressedData)));
}

// Decompress GZIP string
async function decompressString(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();

    const decompressedData = await new Response(ds.readable).arrayBuffer();
    const decoder = new TextDecoder();
    return decoder.decode(decompressedData);
}

// Update compressed save code in background
async function updateCompressedSaveCode() {
    if (messages.length === 0) {
        compressedSaveCode = '';
        return;
    }

    try {
        const jsonString = JSON.stringify(messages);
        compressedSaveCode = await compressString(jsonString);
    } catch (error) {
        console.error('Compression error:', error);
        // Fallback to uncompressed Base64
        const jsonString = JSON.stringify(messages);
        const utf8Encoded = unescape(encodeURIComponent(jsonString));
        compressedSaveCode = 'U:' + btoa(utf8Encoded); // U: prefix for uncompressed
    }
}

async function saveChat() {
    if (messages.length === 0) {
        showToast('保存する会話がありません', 'error');
        return;
    }

    try {
        // Use pre-compressed code if available, otherwise compress now
        let saveCode = compressedSaveCode;
        if (!saveCode) {
            saveCode = await compressString(JSON.stringify(messages));
        }

        await navigator.clipboard.writeText(saveCode);
        showToast('セーブコードをコピーしました！', 'success');
    } catch (error) {
        console.error('Save error:', error);
        showToast('コピーに失敗しました', 'error');
    }
}

async function loadChat() {
    const saveCode = loadInput.value.trim();
    if (!saveCode) {
        showToast('セーブコードを入力してください', 'error');
        return;
    }

    try {
        let jsonString;

        // Check if uncompressed (U: prefix)
        if (saveCode.startsWith('U:')) {
            const base64 = saveCode.slice(2);
            const utf8Decoded = atob(base64);
            jsonString = decodeURIComponent(escape(utf8Decoded));
        } else {
            // Compressed (GZIP)
            jsonString = await decompressString(saveCode);
        }

        const loadedMessages = JSON.parse(jsonString);

        if (!Array.isArray(loadedMessages)) {
            throw new Error('Invalid format');
        }

        // Validate message format
        for (const msg of loadedMessages) {
            if (!msg.role || !msg.content) {
                throw new Error('Invalid message format');
            }
        }

        // Clear current messages
        messages = loadedMessages;

        // Re-render messages
        renderMessages();

        // Update compressed save code
        updateCompressedSaveCode();

        // Save to localStorage
        saveToLocalStorage();

        closeModal(loadModal);
        loadInput.value = '';
        showToast('履歴を読み込みました！', 'success');

    } catch (error) {
        console.error('Load error:', error);
        showToast('無効なセーブコードです', 'error');
    }
}

function renderMessages() {
    // Clear chat messages
    chatMessages.innerHTML = '';

    if (messages.length === 0) {
        // Show welcome message
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-avatar">✨</div>
                <h2>こんにちは！</h2>
                <p id="welcomeText">私は${AI_CONFIG.name}です。何でもお気軽にお話しください。</p>
            </div>
        `;
    } else {
        // Render all messages
        for (const msg of messages) {
            const role = msg.role === 'user' ? 'user' : 'ai';
            addMessage(role, msg.content);
        }
    }
}

function clearChat() {
    if (messages.length === 0) return;

    if (confirm('会話履歴をクリアしますか？')) {
        messages = [];
        compressedSaveCode = '';
        renderMessages();
        saveToLocalStorage();
        showToast('会話をクリアしました', 'success');
    }
}

// ===================================
// Local Storage
// ===================================
function saveToLocalStorage() {
    try {
        localStorage.setItem('gemini-chat-messages', JSON.stringify(messages));
    } catch (error) {
        console.error('LocalStorage save error:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('gemini-chat-messages');
        if (saved) {
            messages = JSON.parse(saved);
            if (messages.length > 0) {
                renderMessages();
                updateCompressedSaveCode();
            }
        }
    } catch (error) {
        console.error('LocalStorage load error:', error);
    }
}

// ===================================
// Modal Handling
// ===================================
function openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// ===================================
// UI Helpers
// ===================================
function updateApiStatus(text) {
    apiStatus.textContent = text;
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

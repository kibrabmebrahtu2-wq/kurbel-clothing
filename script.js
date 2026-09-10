const API_URL = "/.netlify/functions/coach";

let conversations = JSON.parse(
  localStorage.getItem("kibreab_conversations") || "[]"
);

let currentConversationId = null;
let selectedStyle = "CONFIDENT";

const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const conversationList = document.getElementById("conversationList");
const searchInput = document.getElementById("searchInput");

function saveConversations() {
  localStorage.setItem(
    "kibreab_conversations",
    JSON.stringify(conversations)
  );
}

function createConversation() {
  const conversation = {
    id: Date.now().toString(),
    title: "New conversation",
    messages: []
  };

  conversations.unshift(conversation);
  currentConversationId = conversation.id;

  saveConversations();
  renderConversations();
  renderMessages();
}

function getCurrentConversation() {
  return conversations.find(
    conversation => conversation.id === currentConversationId
  );
}

function renderConversations(filter = "") {
  conversationList.innerHTML = "";

  const filtered = conversations.filter(conversation =>
    conversation.title.toLowerCase().includes(filter.toLowerCase())
  );

  filtered.forEach(conversation => {
    const item = document.createElement("div");

    item.className =
      "conversation-item " +
      (conversation.id === currentConversationId ? "active" : "");

    item.textContent = conversation.title;

    item.addEventListener("click", () => {
      currentConversationId = conversation.id;
      renderConversations();
      renderMessages();
    });

    conversationList.appendChild(item);
  });
}

function renderMessages() {
  const conversation = getCurrentConversation();

  chatArea.innerHTML = "";

  if (!conversation || conversation.messages.length === 0) {
    showWelcome();
    return;
  }

  conversation.messages.forEach(message => {
    const messageElement = document.createElement("div");

    messageElement.className =
      "message " + (message.role === "user" ? "user" : "ai");

    const label = document.createElement("div");

    label.className = "message-label";

    label.textContent =
      message.role === "user" ? "YOU" : "KIBREAB AI";

    const text = document.createElement("div");

    text.textContent = message.content;

    messageElement.appendChild(label);
    messageElement.appendChild(text);

    if (message.role === "assistant") {
      const actions = document.createElement("div");

      actions.className = "message-actions";

      const copyButton = document.createElement("button");

      copyButton.textContent = "📋 Copy";

      copyButton.addEventListener("click", () => {
        copyText(message.content);
      });

      const approveButton = document.createElement("button");

      approveButton.textContent = "✓ Approve";

      approveButton.addEventListener("click", () => {
        approveMessage(message.content);
      });

      actions.appendChild(copyButton);
      actions.appendChild(approveButton);

      messageElement.appendChild(actions);
    }

    chatArea.appendChild(messageElement);
  });

  chatArea.scrollTop = chatArea.scrollHeight;
}

function showWelcome() {
  chatArea.innerHTML = `
    <div class="welcome">
      <div class="welcome-icon">K</div>

      <h2>Welcome to Kibreab AI</h2>

      <p>
        Send me a message or describe your conversation.
        I'll help you create a natural, confident response.
      </p>

      <div class="quick-prompts">

        <button data-prompt="She just said hey. Give me a confident reply.">
          💬 She said "hey"
        </button>

        <button data-prompt="Give me a playful reply that keeps the conversation interesting.">
          😏 Make it playful
        </button>

        <button data-prompt="She replied with a short answer. Help me keep the conversation going naturally.">
          🔥 Keep it going
        </button>

        <button data-prompt="Give me three different replies with different levels of flirting.">
          ✨ Give me options
        </button>

      </div>
    </div>
  `;

  document.querySelectorAll("[data-prompt]").forEach(button => {
    button.addEventListener("click", () => {
      messageInput.value = button.dataset.prompt;
      messageInput.focus();
    });
  });
}

async function sendMessage(customMessage = null) {
  const text =
    customMessage !== null
      ? customMessage
      : messageInput.value.trim();

  if (!text) return;

  if (!currentConversationId) {
    createConversation();
  }

  const conversation = getCurrentConversation();

  // Save history BEFORE adding the new message.
  // This prevents sending the same user message twice.
  const previousMessages = conversation.messages.slice(-20);

  conversation.messages.push({
    role: "user",
    content: text
  });

  if (conversation.title === "New conversation") {
    conversation.title =
      text.length > 35
        ? text.substring(0, 35) + "..."
        : text;
  }

  messageInput.value = "";

  saveConversations();
  renderConversations();
  renderMessages();

  const loading = document.createElement("div");

  loading.className = "message ai";

  loading.innerHTML = `
    <div class="message-label">KIBREAB AI</div>
    <div>Thinking...</div>
  `;

  chatArea.appendChild(loading);
  chatArea.scrollTop = chatArea.scrollHeight;

  sendBtn.disabled = true;

  try {
    console.log("Sending request to:", API_URL);

    const response = await fetch(API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        message: text,
        style: selectedStyle,
        conversation: previousMessages
      })
    });

    console.log("Backend status:", response.status);

    const rawText = await response.text();

    console.log("Backend response:", rawText);

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(
        "The server returned an invalid response: " + rawText
      );
    }

    if (!response.ok) {
      throw new Error(
        data.details ||
        data.error ||
        `Server returned HTTP ${response.status}`
      );
    }

    const aiResponse =
      data.reply ||
      data.response ||
      data.message;

    if (!aiResponse) {
      throw new Error(
        "The AI server responded successfully, but no reply was returned."
      );
    }

    loading.remove();

    conversation.messages.push({
      role: "assistant",
      content: aiResponse
    });

    saveConversations();
    renderMessages();

  } catch (error) {
    console.error("Kibreab AI error:", error);

    loading.remove();

    conversation.messages.push({
      role: "assistant",
      content:
        "⚠️ AI connection error:\n\n" +
        error.message
    });

    saveConversations();
    renderMessages();

  } finally {
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

function getUserId() {
  let userId = localStorage.getItem("kibreab_user_id");

  if (!userId) {
    userId =
      "user_" +
      Math.random().toString(36).substring(2) +
      Date.now();

    localStorage.setItem(
      "kibreab_user_id",
      userId
    );
  }

  return userId;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  } catch {
    const textarea = document.createElement("textarea");

    textarea.value = text;

    document.body.appendChild(textarea);

    textarea.select();

    document.execCommand("copy");

    textarea.remove();

    alert("Copied to clipboard!");
  }
}

function approveMessage(text) {
  copyText(text);

  const approval =
    document.getElementById("approvalToggle");

  if (approval && approval.checked) {
    alert(
      "Approved. The response has been copied. Review it before sending."
    );
  }
}

document.querySelectorAll(".style-btn").forEach(button => {
  button.addEventListener("click", () => {

    document
      .querySelectorAll(".style-btn")
      .forEach(btn =>
        btn.classList.remove("active")
      );

    button.classList.add("active");

    selectedStyle =
      button.dataset.style;
  });
});

sendBtn.addEventListener("click", () => {
  sendMessage();
});

messageInput.addEventListener("keydown", event => {
  if (
    event.key === "Enter" &&
    !event.shiftKey
  ) {
    event.preventDefault();
    sendMessage();
  }
});

document
  .getElementById("newChatBtn")
  .addEventListener("click", () => {
    createConversation();
  });

searchInput.addEventListener("input", () => {
  renderConversations(searchInput.value);
});

document
  .getElementById("memoryBtn")
  .addEventListener("click", () => {

    document
      .getElementById("memoryModal")
      .classList.remove("hidden");

    document
      .getElementById("memoryInput")
      .value =
      localStorage.getItem(
        "kibreab_memory"
      ) || "";
  });

document
  .getElementById("saveMemoryBtn")
  .addEventListener("click", () => {

    const memory =
      document
        .getElementById("memoryInput")
        .value.trim();

    localStorage.setItem(
      "kibreab_memory",
      memory
    );

    document
      .getElementById("memoryModal")
      .classList.add("hidden");
  });

document
  .getElementById("integrationsBtn")
  .addEventListener("click", () => {

    document
      .getElementById("integrationsModal")
      .classList.remove("hidden");
  });

document
  .querySelectorAll("[data-close]")
  .forEach(button => {

    button.addEventListener("click", () => {

      const modalId =
        button.dataset.close;

      document
        .getElementById(modalId)
        .classList.add("hidden");
    });
  });

if (conversations.length === 0) {
  createConversation();
} else {
  currentConversationId =
    conversations[0].id;

  renderConversations();
  renderMessages();
                                        }

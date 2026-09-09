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


// -------------------------
// INITIALIZE
// -------------------------

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


// -------------------------
// CONVERSATION SIDEBAR
// -------------------------

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


// -------------------------
// RENDER MESSAGES
// -------------------------

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


// -------------------------
// WELCOME SCREEN
// -------------------------

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

  document
    .querySelectorAll("[data-prompt]")
    .forEach(button => {

      button.addEventListener("click", () => {

        messageInput.value = button.dataset.prompt;

        messageInput.focus();

      });

    });
}


// -------------------------
// SEND MESSAGE
// -------------------------

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

    const response = await fetch(API_URL, {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        userId: getUserId(),

        message: text,

        style: selectedStyle,

        conversation: conversation.messages

      })

    });

    if (!response.ok) {
      throw new Error("Server error");
    }

    const data = await response.json();

    loading.remove();

    const aiResponse =
      data.reply ||
      data.response ||
      data.message ||
      "I couldn't generate a response.";

    conversation.messages.push({
      role: "assistant",
      content: aiResponse
    });

    saveConversations();

    renderMessages();

  } catch (error) {

    loading.remove();

    conversation.messages.push({

      role: "assistant",

      content:
        "I couldn't connect to the AI server yet. Make sure your Netlify backend and OPENAI_API_KEY are configured."

    });

    saveConversations();

    renderMessages();

    console.error(error);

  } finally {

    sendBtn.disabled = false;

    messageInput.focus();

  }
}


// -------------------------
// USER ID
// -------------------------

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


// -------------------------
// COPY
// -------------------------

async function copyText(text) {

  try {

    await navigator.clipboard.writeText(text);

    alert("Copied to clipboard!");

  } catch {

    const textarea =
      document.createElement("textarea");

    textarea.value = text;

    document.body.appendChild(textarea);

    textarea.select();

    document.execCommand("copy");

    textarea.remove();

    alert("Copied to clipboard!");

  }
}


// -------------------------
// APPROVE
// -------------------------

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


// -------------------------
// STYLE BUTTONS
// -------------------------

document
  .querySelectorAll(".style-btn")
  .forEach(button => {

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


// -------------------------
// SEND BUTTON
// -------------------------

sendBtn.addEventListener("click", () => {
  sendMessage();
});


// -------------------------
// ENTER TO SEND
// -------------------------

messageInput.addEventListener("keydown", event => {

  if (
    event.key === "Enter" &&
    !event.shiftKey
  ) {

    event.preventDefault();

    sendMessage();

  }

});


// -------------------------
// NEW CHAT
// -------------------------

document
  .getElementById("newChatBtn")
  .addEventListener("click", () => {

    createConversation();

  });


// -------------------------
// SEARCH
// -------------------------

searchInput.addEventListener("input", () => {

  renderConversations(
    searchInput.value
  );

});


// -------------------------
// MEMORY
// -------------------------

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


// -------------------------
// INTEGRATIONS
// -------------------------

document
  .getElementById("integrationsBtn")
  .addEventListener("click", () => {

    document
      .getElementById("integrationsModal")
      .classList.remove("hidden");

  });


// -------------------------
// CLOSE MODALS
// -------------------------

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


// -------------------------
// START APP
// -------------------------

if (conversations.length === 0) {

  createConversation();

} else {

  currentConversationId =
    conversations[0].id;

  renderConversations();

  renderMessages();

}


import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

const NAVIGATION = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "workspace", label: "AI Workspace", icon: "✧" },
  { id: "agents", label: "AI Agents", icon: "◈" },
  { id: "research", label: "Research", icon: "⌕" },
  { id: "reports", label: "Reports", icon: "▤" },
  { id: "history", label: "Chat History", icon: "◷" },
  { id: "settings", label: "Settings", icon: "⚙" },
];


const AGENTS = [
  {
    name: "Research Agent",
    role: "Information gathering and analysis",
    icon: "⌕",
    color: "blue",
  },
  {
    name: "Writer Agent",
    role: "Content creation and organization",
    icon: "✎",
    color: "purple",
  },
  {
    name: "Reviewer Agent",
    role: "Quality checking and refinement",
    icon: "✓",
    color: "green",
  },
  {
    name: "Factual Validation Agent",
    role: "Independent fact-checking and validation",
    icon: "◆",
    color: "orange",
  },
];

const normalizeOutput = (output) => {
  if (typeof output === "string") return output;

  if (Array.isArray(output)) {
    return output
      .map((item) =>
        typeof item === "string"
          ? item
          : item?.text || item?.content || ""
      )
      .filter(Boolean)
      .join("\n\n");
  }

  if (output && typeof output === "object") {
    return output.text || output.content || "";
  }

  return "";
};

function App() {
  const [page, setPage] = useState("dashboard");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("multiAgentChat") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(
  () => localStorage.getItem("multiAgentConversationId") || null
);
  const [agentStatuses, setAgentStatuses] = useState({
  "Research Agent": "pending",
  "Writer Agent": "pending",
  "Reviewer Agent": "pending",
  "Factual Validation Agent": "pending",
});
  const [activeTabs, setActiveTabs] = useState({});
  const [darkMode, setDarkMode] = useState(true);
  const [historyConversations, setHistoryConversations] = useState([]);
const [historyLoading, setHistoryLoading] = useState(false);
const [historyError, setHistoryError] = useState("");

  const messagesEndRef = useRef(null);
  
useEffect(() => {
  if (page !== "history") return;

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/conversations"
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.detail || "Unable to load history.");
      }

      setHistoryConversations(data.conversations || []);
    } catch (error) {
      console.error("History error:", error);
      setHistoryError(error.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  fetchHistory();
}, [page]);


  useEffect(() => {
    localStorage.setItem(
      "multiAgentChat",
      JSON.stringify(messages)
    );
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);
  useEffect(() => {
  if (conversationId) {
    localStorage.setItem("multiAgentConversationId", conversationId);
  } else {
    localStorage.removeItem("multiAgentConversationId");
  }
}, [conversationId]);

  
  const clearChat = () => {
    if (!window.confirm("Are you sure you want to clear chat history?")) {
      return;
    }

    setMessages([]);
    setConversationId(null);
    setActiveTabs({});
    setMessage("");
    localStorage.removeItem("multiAgentChat");
  };

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMessage = {
      role: "user",
      content: message.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((previous) => [...previous, userMessage]);
    setMessage("");
    setLoading(true);

    setAgentStatuses({
      "Research Agent": "pending",
      "Writer Agent": "pending",
      "Reviewer Agent": "pending",
      "Factual Validation Agent": "pending",
    });

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/chat/stream",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userMessage.content,
            conversation_id: conversationId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || "AI request failed."
        );
      }

      if (!response.body) {
        throw new Error("Streaming response is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let completedPayload = null;

      const processEvent = (rawEvent) => {
        const dataLine = rawEvent
          .split(/\r?\n/)
          .find((line) => line.startsWith("data:"));

        if (!dataLine) return;

        const event = JSON.parse(dataLine.slice(5).trim());

        if (event.type === "status") {
          setAgentStatuses((previous) => ({
            ...previous,
            [event.agent]: event.status,
          }));
        }

        if (event.type === "complete") {
          completedPayload = event;

          setAgentStatuses({
            "Research Agent": "completed",
            "Writer Agent": "completed",
            "Reviewer Agent": "completed",
            "Factual Validation Agent": "completed",
          });
        }

        if (event.type === "error") {
          throw new Error(
            event.message || "Agent execution failed."
          );
        }
      };

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || "";

        events.forEach(processEvent);
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        processEvent(buffer);
      }

      if (!completedPayload) {
        throw new Error("Stream ended without a final response.");
      }

      const data = completedPayload;

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      const finalResponse =
        normalizeOutput(data.response) ||
        "No AI response received.";

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: finalResponse,
          research: normalizeOutput(data.research),
          draft: normalizeOutput(data.draft),
          review: normalizeOutput(data.review),
          final: finalResponse,
          createdAt: new Date().toISOString(),
        },
      ]);

    } catch (error) {
      console.error("Streaming chat error:", error);

      setAgentStatuses((previous) => {
        const updated = { ...previous };

        Object.keys(updated).forEach((agent) => {
          if (
            updated[agent] === "running" ||
            updated[agent] === "pending"
          ) {
            updated[agent] = "failed";
          }
        });

        return updated;
      });

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: `Error: ${error.message}`,
          research: "",
          draft: "",
          final: `Backend connection failed: ${error.message}`,
          createdAt: new Date().toISOString(),
          error: true,
        },
      ]);

    } finally {
      setLoading(false);
    }
  };


  const assistantMessages = messages.filter(
    (item) => item.role === "assistant"
  );

  const researchCount = assistantMessages.filter(
    (item) => item.research
  ).length;

  const pageTitle =
    NAVIGATION.find((item) => item.id === page)?.label ||
    "Dashboard";

  const openWorkspace = () => setPage("workspace");
  
const openSavedConversation = async (id) => {
  try {
    const response = await fetch(
      `http://127.0.0.1:8000/api/conversations/${encodeURIComponent(id)}`
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.detail || "Unable to open conversation.");
    }

    const restoredMessages = [];

    (data.messages || []).forEach((item) => {
      restoredMessages.push({
        role: "user",
        content: item.user || "",
        createdAt: item.timestamp,
      });

      restoredMessages.push({
        role: "assistant",
        content: item.assistant || "",
        research: item.research || "",
        draft: item.draft || "",
        final: item.assistant || "",
        createdAt: item.timestamp,
      });
    });

    setMessages(restoredMessages);
    setConversationId(data.conversation_id);
    setActiveTabs({});
    setPage("workspace");

  } catch (error) {
    console.error("Open conversation error:", error);
    alert(error.message);
  }
};


  const renderChatMessage = (chat, index) => {
    const currentTab = activeTabs[index] || "final";

    return (
      <div
        key={index}
        className={`message-row ${chat.role}`}
      >
        <div className="message-card">
          <div className="message-label">
            {chat.role === "user"
              ? "You"
              : "✧ Multi-Agent AI"}
          </div>

          {chat.role === "assistant" ? (
            <>
              <div className="output-tabs">
                {[
                  { id: "final", label: "Final Answer" },
                  { id: "research", label: "Research Notes" },
                  { id: "draft", label: "Writer Draft" },
                  { id: "review", label: "Reviewer Output" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={
                      currentTab === tab.id
                        ? "tab active-tab"
                        : "tab"
                    }
                    onClick={() =>
                      setActiveTabs((previous) => ({
                        ...previous,
                        [index]: tab.id,
                      }))
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="markdown-response">
                <ReactMarkdown>
                  {currentTab === "research"
  ? chat.research || "No research notes available."
  : currentTab === "draft"
  ? chat.draft || "No writer draft available."
  : currentTab === "review"
  ? chat.review || "No reviewer output available."
  : chat.content || "No final answer available."}
                 
                </ReactMarkdown>
              </div>
            </>
          ) : (
            <p>{chat.content}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`app ${darkMode ? "dark-theme" : "light-theme"}`}>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✧</div>
          <div>
            <h2>AgentFlow</h2>
            <span>AI Intelligence Platform</span>
          </div>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-heading">WORKSPACE</span>

          <nav className="navigation">
            {NAVIGATION.map((item) => (
              <button
                key={item.id}
                className={
                  page === item.id
                    ? "nav-item active-nav"
                    : "nav-item"
                }
                onClick={() => setPage(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-agent-info">
            <span className="online-dot" />
            <span>AI System Online</span>
          </div>

          <div className="profile">
            <div className="profile-avatar">AI</div>
            <div>
              <strong>Project Workspace</strong>
              <span>Final Year Project</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">

        {/* TOP BAR */}
        <header className="topbar">
          <div>
            <span className="breadcrumb">
              AgentFlow / {pageTitle}
            </span>
            <h1>{pageTitle}</h1>
          </div>

          <div className="topbar-actions">
            <span className="system-status">
              <span className="online-dot" />
              System Online
            </span>

            <button
              className="theme-button"
              onClick={() => setDarkMode(!darkMode)}
              title="Change theme"
            >
              {darkMode ? "☀" : "☾"}
            </button>
          </div>
        </header>

        {/* DASHBOARD */}
        {page === "dashboard" && (
          <section className="page-content">
            <div className="welcome-banner">
              <div>
                <span className="eyebrow">MULTI-AGENT INTELLIGENCE</span>
                <h2>Your AI research team is ready.</h2>
                <p>
                  Research, create and review content using
                  your specialized AI agents.
                </p>
                <button
                  className="primary-button"
                  onClick={openWorkspace}
                >
                  Open AI Workspace →
                </button>
              </div>
              <div className="welcome-symbol">✧</div>
            </div>

            <div className="section-heading">
              <div>
                <h2>Platform Overview</h2>
                <p>Your project activity at a glance.</p>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span>Total Conversations</span>
                <strong>{messages.filter(m => m.role === "user").length}</strong>
                <small>Questions submitted</small>
              </div>

              <div className="stat-card">
                <span>AI Responses</span>
                <strong>{assistantMessages.length}</strong>
                <small>Responses generated</small>
              </div>

              <div className="stat-card">
                <span>Research Notes</span>
                <strong>{researchCount}</strong>
                <small>Research outputs available</small>
              </div>

              <div className="stat-card">
                <span>Active Agents</span>
                <strong>{AGENTS.length}</strong>
<small>Research · Writer · Reviewer · Validation</small>
              </div>
            </div>

            <div className="section-heading">
              <div>
                <h2>Meet Your AI Agents</h2>
                <p>Each agent has a specialized responsibility.</p>
              </div>
            </div>

            <div className="agents-grid">
              {AGENTS.map((agent) => (
                <div
                  className="agent-card"
                  key={agent.name}
                >
                  <div className={`agent-icon ${agent.color}`}>
                    {agent.icon}
                  </div>
                  <h3>{agent.name}</h3>
                  <p>{agent.role}</p>
                  <span className="agent-available">
                    <span className="online-dot" />
                    Available
                  </span>
                </div>
              ))}
            </div>

            <div className="section-heading">
              <div>
                <h2>Recent Activity</h2>
                <p>Your latest conversations.</p>
              </div>
              <button
                className="text-button"
                onClick={() => setPage("history")}
              >
                View History →
              </button>
            </div>

            <div className="activity-card">
              {messages.filter(m => m.role === "user").length === 0 ? (
                <p className="empty-text">
                  No activity yet. Start your first AI conversation.
                </p>
              ) : (
                messages
                  .filter(m => m.role === "user")
                  .slice(-4)
                  .reverse()
                  .map((item, index) => (
                    <div className="activity-item" key={index}>
                      <span className="activity-icon">✧</span>
                      <div>
                        <strong>{item.content}</strong>
                        <small>
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString()
                            : "Previous conversation"}
                        </small>
                      </div>
                      <button
                        className="text-button"
                        onClick={openWorkspace}
                      >
                        Open
                      </button>
                    </div>
                  ))
              )}
            </div>
          </section>
        )}

        {/* AI WORKSPACE */}
        {page === "workspace" && (
          <section className="workspace-page">
            <div className="workspace-heading">
              <div>
                <h2>AI Research Workspace</h2>
                <p>
                  Your Researcher, Writer and Reviewer work together.
                </p>
              </div>
              <button
                className="secondary-button"
                onClick={clearChat}
                disabled={messages.length === 0 || loading}
              >
                Clear Chat
              </button>
            </div>

            <div className="chat-container">
              {messages.length === 0 ? (
                <div className="welcome">
                  <div className="welcome-chat-icon">✧</div>
                  <h2>Welcome to Multi-Agent AI</h2>
                  <p>
                    Ask any question. Your request will be processed
                    by the Research, Writer and Reviewer agents.
                  </p>

                  <div className="agent-flow">
                    <span>Research</span>
                    <span>→</span>
                    <span>Writer</span>
                    <span>→</span>
                    <span>Reviewer</span>
                  </div>

                  <button
                    className="suggestion-button"
                    onClick={() =>
                      setMessage(
                        "Explain how multi-agent AI systems work."
                      )
                    }
                  >
                    Try: Explain multi-agent AI →
                  </button>
                </div>
              ) : (
                <div className="messages">
                  {messages.map(renderChatMessage)}

                  
{loading && (
  <div className="message-row assistant">
    <div className="message-card loading-card">
      <div className="message-label">
        ✧ Agent Execution
      </div>

      <div className="agent-status-list">
        {AGENTS.map((agent) => {
          const status = agentStatuses[agent.name] || "pending";

          return (
            <div
              key={agent.name}
              className={`agent-status ${status}`}
            >
              <span className="status-icon">
                {status === "completed"
                  ? "✓"
                  : status === "running"
                  ? "⏳"
                  : status === "failed"
                  ? "✕"
                  : "○"}
              </span>

              <div>
                <strong>{agent.name}</strong>
                <p>
                  {status === "completed"
                    ? "Execution completed"
                    : status === "running"
                    ? "Processing..."
                    : status === "failed"
                    ? "Execution failed"
                    : "Waiting..."}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
)}


                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="input-area">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your AI research team anything..."
                rows={2}
                disabled={loading}
              />
              <button
                className="send-button"
                onClick={sendMessage}
                disabled={!message.trim() || loading}
              >
                {loading ? "Working..." : "Send ↑"}
              </button>
            </div>
            <p className="input-hint">
              Enter to send · Shift + Enter for a new line
            </p>
          </section>
        )}

        {/* AGENTS */}
        {page === "agents" && (
          <section className="page-content">
            <div className="section-heading">
              <div>
                <h2>Specialized AI Agents</h2>
                <p>Three agents coordinate to generate your final response.</p>
              </div>
            </div>

            <div className="agents-grid">
              {AGENTS.map((agent, index) => (
                <div className="agent-card" key={agent.name}>
                  <div className={`agent-icon ${agent.color}`}>
                    {agent.icon}
                  </div>
                  <h3>{agent.name}</h3>
                  <p>{agent.role}</p>
                  <span className="agent-available">
                    <span className="online-dot" />
                    Configured
                  </span>
                  <small>Workflow position: {index + 1}</small>
                </div>
              ))}
            </div>

            <div className="activity-card">
              <h3>Workflow Architecture</h3>
              <div className="agent-flow">
                <span>Research</span>
                <span>→</span>
                <span>Writer</span>
                <span>→</span>
                <span>Reviewer</span>
              </div>
              <p>
                LangGraph coordinates the sequential workflow
                and passes shared state between agents.
              </p>
            </div>
          </section>
        )}

        {/* RESEARCH */}
        {page === "research" && (
          <section className="page-content">
            <div className="section-heading">
              <div>
                <h2>Research Library</h2>
                <p>Research outputs generated by your AI team.</p>
              </div>
            </div>

            {assistantMessages.filter(m => m.research).length === 0 ? (
              <div className="activity-card empty-text">
                No research notes available. Start a conversation first.
              </div>
            ) : (
              assistantMessages
                .filter(m => m.research)
                .map((item, index) => (
                  <div className="activity-card output-card" key={index}>
                    <h3>Research #{index + 1}</h3>
                    <ReactMarkdown>{item.research}</ReactMarkdown>
                  </div>
                ))
            )}
          </section>
        )}

        {/* REPORTS */}
        {page === "reports" && (
          <section className="page-content">
            <div className="section-heading">
              <div>
                <h2>AI Reports</h2>
                <p>Your generated final answers.</p>
              </div>
            </div>

            {assistantMessages.length === 0 ? (
              <div className="activity-card empty-text">
                No reports generated yet.
              </div>
            ) : (
              assistantMessages.map((item, index) => (
                <div className="activity-card output-card" key={index}>
                  <div className="report-header">
                    <h3>AI Report #{index + 1}</h3>
                    <button
                      className="text-button"
                      onClick={() => {
                        const blob = new Blob(
                          [item.content],
                          { type: "text/markdown" }
                        );
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `AI-Report-${index + 1}.md`;
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download ↓
                    </button>
                  </div>
                  <ReactMarkdown>{item.content}</ReactMarkdown>
                </div>
              ))
            )}
          </section>
        )}

       
{/* HISTORY */}
{page === "history" && (
  <section className="page-content">
    <div className="section-heading">
      <div>
        <h2>Conversation History</h2>
        <p>Your saved conversations from MongoDB.</p>
      </div>
    </div>

    <div className="activity-card">
      {historyLoading ? (
        <p className="empty-text">Loading conversations...</p>
      ) : historyError ? (
        <p className="empty-text">Error: {historyError}</p>
      ) : historyConversations.length === 0 ? (
        <p className="empty-text">Your history is empty.</p>
      ) : (
        historyConversations.map((item) => (
          <div
            className="activity-item"
            key={item.conversation_id}
          >
            <span className="activity-icon">◷</span>

            <div>
              <strong>{item.preview || "Untitled conversation"}</strong>
              <small>
                {item.message_count} messages ·{" "}
                {item.updated_at
                  ? new Date(item.updated_at).toLocaleString()
                  : "Saved conversation"}
              </small>
            </div>

            <button
              className="text-button"
              onClick={() =>
                openSavedConversation(item.conversation_id)
              }
            >
              Open Workspace
            </button>
          </div>
        ))
      )}
    </div>
  </section>
)}

        {/* SETTINGS */}
        {page === "settings" && (
          <section className="page-content">
            <div className="section-heading">
              <div>
                <h2>Application Settings</h2>
                <p>Manage your workspace preferences.</p>
              </div>
            </div>

            <div className="activity-card settings-card">
              <div className="settings-row">
                <div>
                  <strong>Appearance</strong>
                  <p>Switch between dark and light themes.</p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => setDarkMode(!darkMode)}
                >
                  {darkMode ? "Switch to Light" : "Switch to Dark"}
                </button>
              </div>

              <div className="settings-row">
                <div>
                  <strong>Chat Storage</strong>
                  <p>Conversations are currently stored in browser localStorage.</p>
                </div>
                <span className="settings-value">Local Storage</span>
              </div>

              <div className="settings-row">
                <div>
                  <strong>AI Backend</strong>
                  <p>FastAPI connected to your LangGraph workflow.</p>
                </div>
                <span className="settings-value">API Integration</span>
              </div>
            </div>
          </section>
        )}

        <footer className="app-footer">
          AgentFlow · Multi-Agent AI Intelligence Platform
        </footer>
      </main>
    </div>
  );
}

export default App;

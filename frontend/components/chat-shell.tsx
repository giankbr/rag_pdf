"use client";

import { useMutation } from "@tanstack/react-query";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { API_BASE_URL, askChatbot, uploadPdf } from "@/lib/api";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  activeDocumentId: number | null;
  updatedAt: number;
};

type ToastMessage = {
  id: string;
  text: string;
  tone: "info" | "success" | "error";
};

const THREADS_STORAGE_KEY = "rag_pdf_chat_threads";
const ACTIVE_THREAD_STORAGE_KEY = "rag_pdf_active_thread_id";

function makeThreadTitle(question: string): string {
  const trimmed = question.trim();
  if (!trimmed) return "New Chat";
  return trimmed.length > 42 ? `${trimmed.slice(0, 42)}...` : trimmed;
}

function createEmptyThread(): ChatThread {
  return {
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "New Chat",
    messages: [],
    activeDocumentId: null,
    updatedAt: Date.now()
  };
}

function normalizeAssistantContent(content: string): string {
  const backendFilesBase = `${API_BASE_URL.replace(/\/$/, "")}/files/raw_pdfs/`;
  return content
    .replaceAll("http://localhost:3000/files/raw_pdfs/", backendFilesBase)
    .replaceAll("http://127.0.0.1:3000/files/raw_pdfs/", backendFilesBase);
}

export default function ChatShell() {
  const [question, setQuestion] = useState("");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const rawThreads = window.localStorage.getItem(THREADS_STORAGE_KEY);
      const rawActiveId = window.localStorage.getItem(ACTIVE_THREAD_STORAGE_KEY);

      if (!rawThreads) {
        const initialThread = createEmptyThread();
        setThreads([initialThread]);
        setActiveThreadId(initialThread.id);
        return;
      }

      const parsedThreads = JSON.parse(rawThreads) as ChatThread[];
      if (!Array.isArray(parsedThreads) || parsedThreads.length === 0) {
        const fallbackThread = createEmptyThread();
        setThreads([fallbackThread]);
        setActiveThreadId(fallbackThread.id);
        return;
      }

      const sanitizedThreads = parsedThreads
        .map((thread) => ({
          id: typeof thread.id === "string" ? thread.id : `thread-${Date.now()}`,
          title: typeof thread.title === "string" ? thread.title : "New Chat",
          messages: Array.isArray(thread.messages)
            ? thread.messages.filter(
                (item) =>
                  item &&
                  (item.role === "user" || item.role === "assistant") &&
                  typeof item.content === "string"
              )
            : [],
          activeDocumentId:
            typeof thread.activeDocumentId === "number" ? thread.activeDocumentId : null,
          updatedAt: typeof thread.updatedAt === "number" ? thread.updatedAt : Date.now()
        }))
        .filter((thread) => Boolean(thread.id));

      if (sanitizedThreads.length === 0) {
        const fallbackThread = createEmptyThread();
        setThreads([fallbackThread]);
        setActiveThreadId(fallbackThread.id);
        return;
      }

      setThreads(sanitizedThreads);
      const validActiveId = sanitizedThreads.some((thread) => thread.id === rawActiveId)
        ? (rawActiveId as string)
        : sanitizedThreads[0].id;
      setActiveThreadId(validActiveId);
    } catch {
      const fallbackThread = createEmptyThread();
      setThreads([fallbackThread]);
      setActiveThreadId(fallbackThread.id);
    }
  }, []);

  useEffect(() => {
    if (threads.length === 0) return;
    window.localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    if (!activeThreadId) return;
    window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, activeThreadId);
  }, [activeThreadId]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  function pushToast(text: string, tone: ToastMessage["tone"] = "info") {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  }

  const chatMutation = useMutation({
    mutationFn: askChatbot,
    onSuccess: (data, payload) => {
      const asked = payload.question;
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== activeThreadId) return thread;
          const hasUserMessage = thread.messages.some((message) => message.role === "user");
          const updatedMessages = [
            ...thread.messages,
            { role: "user" as const, content: asked },
            { role: "assistant" as const, content: data.answer }
          ];
          return {
            ...thread,
            title: hasUserMessage ? thread.title : makeThreadTitle(asked),
            messages: updatedMessages,
            updatedAt: Date.now()
          };
        })
      );
      setQuestion("");
    }
  });

  const uploadMutation = useMutation({
    mutationFn: uploadPdf,
    onSuccess: (data) => {
      pushToast(`Uploaded ${data.file_name} (${data.chunks} chunks)`, "success");
      const absoluteFileUrl = new URL(data.file_url, API_BASE_URL).toString();
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== activeThreadId) return thread;
          return {
            ...thread,
            activeDocumentId: data.document_id,
            messages: [
              ...thread.messages,
              {
                role: "assistant",
                content:
                  `PDF [${data.file_name}](${absoluteFileUrl}) berhasil diupload ` +
                  `dan diingest (${data.chunks} chunks).`
              }
            ],
            updatedAt: Date.now()
          };
        })
      );
    },
    onError: (error) => {
      const text = error instanceof Error ? error.message : "Upload failed";
      pushToast(text, "error");
    }
  });

  const canSend = useMemo(() => question.trim().length > 0 && !chatMutation.isPending, [question, chatMutation.isPending]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    chatMutation.mutate({ question: trimmed, documentId: activeThread?.activeDocumentId ?? null });
  }

  function createNewChat() {
    const newThread = createEmptyThread();
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
    setQuestion("");
  }

  function startRenameThread(threadId: string) {
    const target = threads.find((thread) => thread.id === threadId);
    if (!target) return;
    setRenameTargetId(threadId);
    setRenameValue(target.title);
  }

  function confirmRenameThread() {
    if (!renameTargetId) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === renameTargetId ? { ...thread, title: trimmed, updatedAt: Date.now() } : thread
      )
    );
    pushToast("Thread renamed", "success");
    setRenameTargetId(null);
    setRenameValue("");
  }

  function startDeleteThread(threadId: string) {
    setDeleteTargetId(threadId);
  }

  function confirmDeleteThread() {
    if (!deleteTargetId) return;
    const threadId = deleteTargetId;
    const target = threads.find((thread) => thread.id === threadId);
    if (!target) return;

    setThreads((prev) => {
      const remaining = prev.filter((thread) => thread.id !== threadId);
      if (remaining.length === 0) {
        const fallback = createEmptyThread();
        setActiveThreadId(fallback.id);
        return [fallback];
      }

      if (activeThreadId === threadId) {
        setActiveThreadId(remaining[0].id);
      }
      return remaining;
    });
    pushToast("Thread deleted", "success");
    setDeleteTargetId(null);
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!activeThread) return;
    const file = event.target.files?.[0];
    if (!file) return;
    pushToast("Uploading PDF...", "info");
    uploadMutation.mutate(file);
    event.target.value = "";
  }

  const sortedThreads = useMemo(() => [...threads].sort((a, b) => b.updatedAt - a.updatedAt), [threads]);
  const filteredThreads = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return sortedThreads;
    return sortedThreads.filter((thread) => thread.title.toLowerCase().includes(keyword));
  }, [sortedThreads, searchTerm]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">NOVA AI PDF</div>
        <button className="new-chat-btn" type="button" onClick={createNewChat}>
          + New Chat
        </button>
        <div className="menu-title">Chat History</div>
        <input
          className="thread-search-input"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search thread..."
        />
        <div className="prompt-list">
          {filteredThreads.length === 0 ? (
            <div className="history-empty">Belum ada history chat.</div>
          ) : (
            filteredThreads.map((thread) => (
              <div
                key={thread.id}
                className={`prompt-item thread-item ${thread.id === activeThreadId ? "active" : ""}`}
              >
                <button
                  className="thread-main-btn"
                  type="button"
                  onClick={() => {
                    setActiveThreadId(thread.id);
                  }}
                >
                  <div className="thread-title">{thread.title}</div>
                  <div className="thread-meta">{thread.messages.length} messages</div>
                </button>
                <div className="thread-actions">
                  <button type="button" className="thread-action-btn" onClick={() => startRenameThread(thread.id)}>
                    Rename
                  </button>
                  <button
                    type="button"
                    className="thread-action-btn danger"
                    onClick={() => startDeleteThread(thread.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="chat-panel">
        <header className="topbar">
          <div className="topbar-title">NOVA AI PDF</div>
        </header>

        <section className="conversation">
          {!activeThread || activeThread.messages.length === 0 ? (
            <div className="empty-state">
              <h1>Let&apos;s start a smart conversation</h1>
              <p>Ask about your PDF docs and we will retrieve answers from FAQ or RAG chunks.</p>
            </div>
          ) : (
            activeThread.messages.map((message, idx) => (
              <article key={`${message.role}-${idx}`} className={`bubble ${message.role}`}>
                <div className="bubble-role">{message.role === "user" ? "You" : "Assistant"}</div>
                {message.role === "assistant" ? (
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {normalizeAssistantContent(message.content)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p>{message.content}</p>
                )}
              </article>
            ))
          )}
          {chatMutation.isPending && <div className="typing">Assistant is thinking...</div>}
          {chatMutation.isError && (
            <div className="error">
              Failed to get response. Check backend API URL or FastAPI server status.
            </div>
          )}
        </section>

        <form className="composer" onSubmit={handleSubmit}>
          {activeThread?.activeDocumentId !== null && (
            <div className="active-doc-badge">Active PDF document_id: {activeThread?.activeDocumentId}</div>
          )}
          <label className="upload-btn inline" htmlFor="pdf-upload">
            Upload PDF
          </label>
          <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleFileUpload} hidden />
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask me anything about your PDF..."
          />
          <button className="send-btn" type="submit" disabled={!canSend}>
            Send
          </button>
        </form>
      </main>

      {renameTargetId && (
        <div className="modal-backdrop" onClick={() => setRenameTargetId(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>Rename Thread</h3>
            <input
              className="modal-input"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="Thread title"
            />
            <div className="modal-actions">
              <button className="modal-btn" type="button" onClick={() => setRenameTargetId(null)}>
                Cancel
              </button>
              <button className="modal-btn primary" type="button" onClick={confirmRenameThread}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTargetId && (
        <div className="modal-backdrop" onClick={() => setDeleteTargetId(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>Delete Thread</h3>
            <p className="modal-text">This thread will be removed permanently.</p>
            <div className="modal-actions">
              <button className="modal-btn" type="button" onClick={() => setDeleteTargetId(null)}>
                Cancel
              </button>
              <button className="modal-btn danger" type="button" onClick={confirmDeleteThread}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast-item ${toast.tone}`}>
              {toast.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

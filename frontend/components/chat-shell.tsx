"use client";

import { useMutation } from "@tanstack/react-query";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { askChatbot, uploadPdf } from "@/lib/api";

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

export default function ChatShell() {
  const [question, setQuestion] = useState("");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [uploadStatus, setUploadStatus] = useState<string>("");

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

  const chatMutation = useMutation({
    mutationFn: askChatbot,
    onSuccess: (data, payload) => {
      const asked = payload.question;
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== activeThreadId) return thread;
          const updatedMessages = [
            ...thread.messages,
            { role: "user" as const, content: asked },
            { role: "assistant" as const, content: data.answer }
          ];
          return {
            ...thread,
            title: thread.messages.length === 0 ? makeThreadTitle(asked) : thread.title,
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
      setUploadStatus(`Uploaded ${data.file_name} (${data.chunks} chunks)`);
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
                content: `PDF "${data.file_name}" berhasil diupload dan diingest (${data.chunks} chunks).`
              }
            ],
            updatedAt: Date.now()
          };
        })
      );
    },
    onError: (error) => {
      const text = error instanceof Error ? error.message : "Upload failed";
      setUploadStatus(text);
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
    setUploadStatus("");
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!activeThread) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadStatus("Uploading PDF...");
    uploadMutation.mutate(file);
    event.target.value = "";
  }

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => b.updatedAt - a.updatedAt),
    [threads]
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">RAG PDF</div>
        <button className="new-chat-btn" type="button" onClick={createNewChat}>
          + New Chat
        </button>
        {uploadStatus && <div className="upload-status">{uploadStatus}</div>}
        {activeThread?.activeDocumentId !== null && (
          <div className="upload-status">Active PDF document_id: {activeThread?.activeDocumentId}</div>
        )}
        <div className="menu-title">Chat History</div>
        <div className="prompt-list">
          {sortedThreads.length === 0 ? (
            <div className="history-empty">Belum ada history chat.</div>
          ) : (
            sortedThreads.map((thread) => (
              <button
                key={thread.id}
                className={`prompt-item thread-item ${thread.id === activeThreadId ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setActiveThreadId(thread.id);
                  setUploadStatus("");
                }}
              >
                <div className="thread-title">{thread.title}</div>
                <div className="thread-meta">{thread.messages.length} messages</div>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="chat-panel">
        <header className="topbar">
          <div className="topbar-title">RAG Chatbot PDF</div>
          <div className="topbar-subtitle">Next.js + TanStack Query</div>
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
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
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
    </div>
  );
}

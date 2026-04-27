"use client";

import { useMutation } from "@tanstack/react-query";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { askChatbot, uploadPdf } from "@/lib/api";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatShell() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const chatMutation = useMutation({
    mutationFn: askChatbot,
    onSuccess: (data, askedQuestion) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: askedQuestion },
        { role: "assistant", content: data.answer }
      ]);
      setQuestion("");
    }
  });

  const uploadMutation = useMutation({
    mutationFn: uploadPdf,
    onSuccess: (data) => {
      setUploadStatus(`Uploaded ${data.file_name} (${data.chunks} chunks)`);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `PDF "${data.file_name}" berhasil diupload dan diingest (${data.chunks} chunks).`
        }
      ]);
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
    chatMutation.mutate(trimmed);
  }

  function resetChat() {
    setMessages([]);
    setQuestion("");
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadStatus("Uploading PDF...");
    uploadMutation.mutate(file);
    event.target.value = "";
  }

  const historyItems = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .reverse();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">RAG PDF</div>
        <button className="new-chat-btn" type="button" onClick={resetChat}>
          + New Chat
        </button>
        {uploadStatus && <div className="upload-status">{uploadStatus}</div>}
        <div className="menu-title">Chat History</div>
        <div className="prompt-list">
          {historyItems.length === 0 ? (
            <div className="history-empty">Belum ada history chat.</div>
          ) : (
            historyItems.map((item, idx) => (
              <button key={`${item}-${idx}`} className="prompt-item" type="button" onClick={() => setQuestion(item)}>
                {item}
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
          {messages.length === 0 ? (
            <div className="empty-state">
              <h1>Let&apos;s start a smart conversation</h1>
              <p>Ask about your PDF docs and we will retrieve answers from FAQ or RAG chunks.</p>
            </div>
          ) : (
            messages.map((message, idx) => (
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

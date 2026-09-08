"use client";

import { useEffect, useRef, useState } from "react";
import { getMessages, sendMessage } from "@/lib/api";

export default function MessageThread({ booking, currentUserId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  function load() {
    return getMessages(booking.booking_id, currentUserId)
      .then(setMessages)
      .catch((err) => setErrorMsg(err.message));
  }

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.booking_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    setErrorMsg(null);
    try {
      await sendMessage(booking.booking_id, currentUserId, text);
      setDraft("");
      await load();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column" }}>
        <div className="modal-handle" />
        <button className="close-btn" onClick={onClose} aria-label="Close" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>

        <div className="modal-title">Messages</div>
        <div className="modal-subtitle">About &ldquo;{booking.equipment_name}&rdquo;</div>

        <div className="message-list">
          {loading && <div className="loading-state">Loading messages...</div>}
          {errorMsg && <div className="field-error">{errorMsg}</div>}
          {!loading && messages.length === 0 && (
            <div className="empty-state" style={{ padding: "24px 0" }}>
              No messages yet. Say hello!
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.message_id}
              className={`message-bubble-row ${m.sender_id === currentUserId ? "mine" : ""}`}
            >
              <div className="message-bubble">
                <div className="message-sender">{m.sender_id === currentUserId ? "You" : m.sender_name}</div>
                <div>{m.message_text}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="message-input-row">
          <input
            type="text"
            placeholder="Type a message..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
          />
          <button type="submit" className="rent-btn" disabled={sending || !draft.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

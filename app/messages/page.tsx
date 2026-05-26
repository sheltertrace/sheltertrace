"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/app/providers";
import { supabase } from "@/lib/supabase";
import {
  fetchConversationsForUser,
  fetchMessages,
  sendMessage,
  markConversationRead,
  deleteMessage,
  findOrCreateDirectConversation,
  createGroupConversation,
  fetchStaffForMessaging,
  type StaffPickerEntry,
} from "@/lib/messages";
import type { Conversation, Message } from "@/lib/types";

// ── Notification sound (Web Audio API — no external file needed) ─────────────

function playNotificationSound(): void {
  try {
    type AudioCtxCtor = typeof AudioContext;
    const AudioCtx: AudioCtxCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx       = new AudioCtx();
    const osc       = ctx.createOscillator();
    const gain      = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type             = "sine";
    osc.frequency.value  = 880;   // A5
    gain.gain.value      = 0.28;
    osc.start();
    setTimeout(() => { osc.frequency.value = 1174; }, 150); // D6
    setTimeout(() => { osc.stop(); ctx.close(); }, 320);
  } catch { /* silently ignore if audio unavailable */ }
}

function showBrowserNotification(senderName: string, preview: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification("New Message — ShelterTrace", {
      body: `${senderName}: ${preview}`,
      icon: "/mcas_logo.png",
      tag:  "sheltertrace-msg",
    });
  } catch { /* ignore */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#0f2942","#1a8a8a","#6366f1","#f59e0b","#dc2626","#16a34a","#7c3aed","#0891b2",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0x7fffffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (isYesterday) return `Yesterday ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// ── Avatar component ──────────────────────────────────────────────────────────

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const bg = avatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.38, fontWeight: 800, flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg, isMine, showSender, onDelete, onReply,
}: {
  msg: Message; isMine: boolean; showSender: boolean;
  onDelete: (id: string) => void; onReply: (msg: Message) => void;
}) {
  const [hover, setHover] = useState(false);
  const isUrgent = msg.message_type === "urgent";
  const isSystem = msg.message_type === "system";
  const deleted  = msg.is_deleted;

  if (isSystem) {
    return (
      <div style={{ textAlign: "center", padding: "4px 0", fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>
        {msg.content}
      </div>
    );
  }

  return (
    <div
      style={{ display: "flex", flexDirection: isMine ? "row-reverse" : "row", gap: 8, alignItems: "flex-end", marginBottom: 4 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!isMine && <Avatar name={msg.sender_name} size={28} />}

      <div style={{ maxWidth: "68%", display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}>
        {showSender && !isMine && (
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 2, paddingLeft: 4 }}>
            {msg.sender_name}
          </div>
        )}

        {/* Reply quote */}
        {msg.reply_to && (
          <div style={{ fontSize: 11, padding: "4px 10px", borderLeft: "3px solid var(--teal)", background: "var(--bg-alt)", borderRadius: "6px 6px 0 0", color: "var(--text-secondary)", maxWidth: "100%", marginBottom: 2 }}>
            <strong>{msg.reply_to.sender_name}:</strong> {msg.reply_to.is_deleted ? "Message deleted" : msg.reply_to.content.slice(0, 60)}
          </div>
        )}

        <div style={{
          padding: "8px 12px", borderRadius: 16,
          borderBottomLeftRadius: !isMine ? 4 : 16,
          borderBottomRightRadius: isMine ? 4 : 16,
          background: deleted ? "#e5e7eb" : isUrgent ? "#fef2f2" : isMine ? "#0f2942" : "var(--surface)",
          color: deleted ? "#9ca3af" : isUrgent ? "#dc2626" : isMine ? "#fff" : "var(--text)",
          border: isUrgent ? "1px solid #fca5a5" : isMine ? "none" : "1px solid var(--border)",
          fontSize: 14, lineHeight: 1.5, wordBreak: "break-word",
        }}>
          {isUrgent && <span style={{ fontSize: 10, fontWeight: 800, marginRight: 6 }}>🚨 URGENT</span>}
          {deleted ? <em>Message deleted</em> : msg.content}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, paddingLeft: 4, paddingRight: 4 }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmtTime(msg.created_at)}</span>
          {hover && !deleted && (
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => onReply(msg)} style={{ fontSize: 11, background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 6, padding: "1px 6px", cursor: "pointer", color: "var(--text-secondary)" }}>↩ Reply</button>
              {isMine && <button onClick={() => onDelete(msg.id)} style={{ fontSize: 11, background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "1px 6px", cursor: "pointer", color: "#dc2626" }}>Delete</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── New conversation modal ────────────────────────────────────────────────────

function NewConversationModal({
  staff, currentUserId, onClose, onStart,
}: {
  staff: StaffPickerEntry[];
  currentUserId: string;
  onClose: () => void;
  onStart: (ids: string[], name?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return staff
      .filter((s) => s.id !== currentUserId)
      .filter((s) => !q || s.displayName.toLowerCase().includes(q) || s.role.toLowerCase().includes(q));
  }, [staff, search, currentUserId]);

  const PRESETS = [
    { label: "All Staff",  ids: staff.map((s) => s.id).filter((id) => id !== currentUserId), name: "All Staff" },
    { label: "Officers",   ids: staff.filter((s) => s.role.includes("Officer")).map((s) => s.id).filter((id) => id !== currentUserId), name: "Officers" },
    { label: "Admin",      ids: staff.filter((s) => s.role.includes("Admin")).map((s) => s.id).filter((id) => id !== currentUserId), name: "Administrators" },
  ];

  const isGroup = selected.length > 1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <span className="modal-title">New Message</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Preset groups */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {PRESETS.map((p) => (
              <button key={p.label} className="btn btn-secondary btn-sm" onClick={() => onStart(p.ids, p.name)} style={{ fontSize: 12 }}>
                👥 {p.label}
              </button>
            ))}
          </div>

          <input
            autoFocus className="form-input" placeholder="Search staff by name or role…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 10 }}
          />

          <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
            {filtered.map((s) => {
              const checked = selected.includes(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => setSelected((p) => checked ? p.filter((x) => x !== s.id) : [...p, s.id])}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", background: checked ? "#f0fdfa" : "var(--bg)" }}
                >
                  <input type="checkbox" checked={checked} readOnly style={{ accentColor: "var(--teal)" }} />
                  <Avatar name={s.displayName} size={28} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.displayName}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s.role}{s.badge ? ` · Badge ${s.badge}` : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {isGroup && (
            <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
              <label className="form-label">Group Name</label>
              <input className="form-input" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Evening Shift, K9 Team…" />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!selected.length || (isGroup && !groupName.trim())}
            onClick={() => onStart(selected, isGroup ? groupName.trim() : undefined)}
          >
            {isGroup ? "Create Group" : "Open Chat"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [staff, setStaff] = useState<StaffPickerEntry[]>([]);
  const [convSearch, setConvSearch] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("msg_muted") === "true";
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const realtimeRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const userId      = user?.id ?? "";
  const userDisplay = user ? `${user.firstName ?? user.first_name ?? ""} ${user.lastName ?? user.last_name ?? ""}`.trim() || user.username : "Staff";
  const activeConv  = conversations.find((c) => c.id === activeConvId);

  // ── Load conversations ──────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!userId) return;
    const convs = await fetchConversationsForUser(userId);
    setConversations(convs);
    setLoadingConvs(false);
  }, [userId]);

  useEffect(() => {
    loadConversations();
    fetchStaffForMessaging().then(setStaff);
    // Request browser notification permission on first visit to this page
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [loadConversations]);

  // ── Load messages for active conversation ───────────────────────────────────
  useEffect(() => {
    if (!activeConvId) return;
    setLoadingMsgs(true);
    fetchMessages(activeConvId, 60)
      .then(setMessages)
      .finally(() => setLoadingMsgs(false));
    markConversationRead(activeConvId, userId).then(() => {
      // Update unread count in conversation list
      setConversations((prev) =>
        prev.map((c) => c.id === activeConvId ? { ...c, unreadCount: 0 } : c)
      );
    });
  }, [activeConvId, userId]);

  // ── Auto-scroll on new messages ─────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Supabase Realtime subscription ──────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    // Remove previous subscription
    if (realtimeRef.current) {
      supabase.removeChannel(realtimeRef.current);
    }

    const channel = supabase
      .channel(`messages:user:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: { new: Message }) => {
          const msg = payload.new;
          const isOwnMessage = msg.sender_id === userId;

          // Play sound + browser notification for any incoming message (not our own)
          if (!isOwnMessage) {
            const muteFlag = localStorage.getItem("msg_muted") === "true";
            if (!muteFlag) playNotificationSound();
            // Show browser notification when tab is hidden or user is elsewhere
            if (document.hidden || msg.conversation_id !== activeConvId) {
              showBrowserNotification(
                msg.sender_name,
                msg.is_deleted ? "Message deleted" : msg.content.slice(0, 80)
              );
            }
          }

          // If in the active conversation, add the message
          if (msg.conversation_id === activeConvId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            if (!isOwnMessage) {
              markConversationRead(msg.conversation_id, userId);
            }
          } else if (!isOwnMessage) {
            // Update unread count in conversation list
            setConversations((prev) =>
              prev.map((c) =>
                c.id === msg.conversation_id
                  ? { ...c, unreadCount: (c.unreadCount ?? 0) + 1, lastMessage: msg, updated_at: msg.created_at }
                  : c
              ).sort((a, b) => (b.updated_at ?? "") > (a.updated_at ?? "") ? 1 : -1)
            );
          }
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") console.log("[messages] Realtime connected");
        if (status === "CHANNEL_ERROR") {
          // Fallback to polling every 5 seconds
          console.warn("[messages] Realtime unavailable, falling back to polling");
        }
      });

    realtimeRef.current = channel;

    // Polling fallback (fires regardless; realtime deduplicates)
    const pollId = setInterval(loadConversations, 15_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollId);
    };
  }, [userId, activeConvId, loadConversations]);

  // ── Send message ────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!text.trim() || !activeConvId || !userId || sending) return;
    setSending(true);
    const content = text.trim();
    setText("");
    setReplyTo(null);
    setIsUrgent(false);
    // Auto-resize textarea
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    try {
      const msg = await sendMessage({
        conversation_id: activeConvId,
        sender_id: userId,
        sender_name: userDisplay,
        content,
        message_type: isUrgent ? "urgent" : "text",
        reply_to_id: replyTo?.id ?? null,
        is_deleted: false,
      });
      setMessages((prev) => [...prev, msg]);
      setConversations((prev) =>
        prev.map((c) => c.id === activeConvId ? { ...c, lastMessage: msg, updated_at: msg.created_at } : c)
          .sort((a, b) => (b.updated_at ?? "") > (a.updated_at ?? "") ? 1 : -1)
      );
    } finally { setSaving(false); }

    function setSaving(v: boolean) { setSending(v); }
  }

  // ── Delete message ──────────────────────────────────────────────────────────
  async function handleDelete(msgId: string) {
    await deleteMessage(msgId);
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, is_deleted: true, content: "" } : m));
  }

  // ── Start / open conversation ───────────────────────────────────────────────
  async function handleStartConversation(ids: string[], groupName?: string) {
    setShowNewConv(false);
    if (!userId) return;
    let conv: Conversation;
    if (ids.length === 1) {
      conv = await findOrCreateDirectConversation(userId, ids[0], userDisplay);
    } else {
      conv = await createGroupConversation(groupName ?? "Group", [userId, ...ids], userId);
    }
    await loadConversations();
    setActiveConvId(conv.id);
    setMobileView("chat");
  }

  // ── Computed ────────────────────────────────────────────────────────────────
  const filteredConvs = useMemo(() => {
    const q = convSearch.toLowerCase();
    return conversations.filter((c) => {
      if (!q) return true;
      const name = c.name ?? c.otherParticipantName ?? "";
      return name.toLowerCase().includes(q);
    });
  }, [conversations, convSearch]);

  const convName = (c: Conversation): string =>
    c.type === "direct" ? (c.otherParticipantName ?? "Unknown") : (c.name ?? "Group");

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount ?? 0), 0);

  // ── Group messages by day ───────────────────────────────────────────────────
  const groupedMessages = useMemo(() => {
    const groups: { day: string; msgs: Message[] }[] = [];
    messages.forEach((msg) => {
      const day = new Date(msg.created_at).toDateString();
      const last = groups[groups.length - 1];
      if (!last || last.day !== day) {
        groups.push({ day, msgs: [msg] });
      } else {
        last.msgs.push(msg);
      }
    });
    return groups;
  }, [messages]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AppShell
      title="Messages"
      action={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {totalUnread > 0 && <span style={{ fontSize: 12, color: "#0d9488", fontWeight: 700 }}>{totalUnread} unread</span>}
          <button
            title={muted ? "Sound muted — click to unmute" : "Sound on — click to mute"}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              localStorage.setItem("msg_muted", String(next));
            }}
            style={{ background: muted ? "#fee2e2" : "#f0fdfa", border: `1px solid ${muted ? "#fca5a5" : "#99f6e4"}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 14, fontWeight: 700, color: muted ? "#dc2626" : "#0d9488" }}
          >
            {muted ? "🔇 Muted" : "🔔 Sound On"}
          </button>
        </div>
      }
    >
      <style>{`
        .msg-layout { display: flex; height: calc(100dvh - 72px); overflow: hidden; }
        .msg-sidebar { width: 300px; border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; background: var(--bg); }
        .msg-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .conv-item { padding: 11px 14px; cursor: pointer; border-bottom: 1px solid var(--border-light); transition: background 0.1s; }
        .conv-item:hover { background: var(--bg-alt); }
        .conv-item.active { background: #f0fdfa; border-left: 3px solid var(--teal); }
        .msg-area { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 2px; }
        .msg-input-bar { border-top: 1px solid var(--border); padding: 12px 16px; display: flex; gap: 8px; align-items: flex-end; background: var(--bg); }
        @media (max-width: 640px) {
          .msg-sidebar { width: 100%; display: ${mobileView === "list" ? "flex" : "none"}; flex-direction: column; }
          .msg-main { display: ${mobileView === "chat" ? "flex" : "none"}; }
        }
      `}</style>

      <div className="msg-layout">
        {/* ── Conversation list ── */}
        <div className="msg-sidebar">
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8 }}>
            <input className="form-input" placeholder="Search…" value={convSearch} onChange={(e) => setConvSearch(e.target.value)} style={{ flex: 1, fontSize: 13 }} />
            <button className="btn btn-primary btn-sm" onClick={() => setShowNewConv(true)} style={{ whiteSpace: "nowrap" }}>+ New</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingConvs ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
            ) : filteredConvs.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No conversations yet.<br />Click <strong>+ New</strong> to start one.
              </div>
            ) : filteredConvs.map((c) => {
              const unread = c.unreadCount ?? 0;
              const last = c.lastMessage;
              return (
                <div
                  key={c.id}
                  className={`conv-item ${c.id === activeConvId ? "active" : ""}`}
                  onClick={() => { setActiveConvId(c.id); setMobileView("chat"); }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <Avatar name={convName(c)} size={32} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: unread > 0 ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {convName(c)}
                          {c.type === "group" && <span style={{ fontSize: 10, color: "var(--text-secondary)", marginLeft: 4 }}>group</span>}
                        </div>
                        {last && (
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: unread > 0 ? 600 : 400 }}>
                            {last.is_deleted ? "Message deleted" : (last.sender_id === userId ? "You: " : "") + last.content.slice(0, 40)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      {last && <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtTime(last.created_at)}</span>}
                      {unread > 0 && (
                        <span style={{ background: "#0d9488", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 999, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Message view ── */}
        <div className="msg-main">
          {!activeConvId ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexDirection: "column", gap: 12 }}>
              <span style={{ fontSize: 48 }}>💬</span>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Select a conversation</div>
              <div style={{ fontSize: 13 }}>or click <strong>+ New</strong> to start one</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "var(--bg)" }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ display: "none" }}
                  id="msg-back"
                  onClick={() => setMobileView("list")}
                >← Back</button>
                <style>{`@media(max-width:640px){#msg-back{display:inline-flex!important}}`}</style>
                {activeConv && <Avatar name={convName(activeConv)} size={34} />}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{activeConv ? convName(activeConv) : "…"}</div>
                  {activeConv?.type === "group" && (
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {activeConv.participants.length} members
                    </div>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="msg-area">
                {loadingMsgs ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>Loading messages…</div>
                ) : groupedMessages.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 14 }}>
                    No messages yet. Say hello! 👋
                  </div>
                ) : groupedMessages.map(({ day, msgs: dayMsgs }) => (
                  <div key={day}>
                    {/* Day separator */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 8px" }}>
                      <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
                      <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", fontWeight: 600 }}>
                        {dayLabel(dayMsgs[0].created_at)}
                      </span>
                      <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
                    </div>
                    {dayMsgs.map((msg, i) => {
                      const isMine = msg.sender_id === userId;
                      const showSender = i === 0 || dayMsgs[i - 1].sender_id !== msg.sender_id;
                      // Hydrate reply_to
                      const msgWithReply = msg.reply_to_id
                        ? { ...msg, reply_to: messages.find((m) => m.id === msg.reply_to_id) ?? null }
                        : msg;
                      return (
                        <MessageBubble
                          key={msg.id}
                          msg={msgWithReply}
                          isMine={isMine}
                          showSender={showSender}
                          onDelete={handleDelete}
                          onReply={setReplyTo}
                        />
                      );
                    })}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div className="msg-input-bar">
                {/* Reply preview */}
                {replyTo && (
                  <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, background: "var(--bg-alt)", borderTop: "1px solid var(--border)", padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      ↩ Replying to <strong>{replyTo.sender_name}</strong>: {replyTo.content.slice(0, 50)}
                    </div>
                    <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                )}

                <div style={{ position: "relative", flex: 1 }}>
                  {/* Urgent toggle */}
                  <button
                    title="Mark as Urgent"
                    onClick={() => setIsUrgent((v) => !v)}
                    style={{ position: "absolute", left: 10, bottom: 9, background: "none", border: "none", cursor: "pointer", fontSize: 16, opacity: isUrgent ? 1 : 0.4 }}
                  >
                    🚨
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={isUrgent ? "🚨 Urgent message…" : "Message… (Enter to send, Shift+Enter for new line)"}
                    rows={1}
                    style={{
                      width: "100%", resize: "none", border: `1px solid ${isUrgent ? "#fca5a5" : "var(--border)"}`,
                      borderRadius: 10, padding: "9px 42px 9px 38px", fontSize: 14,
                      background: isUrgent ? "#fff5f5" : "var(--bg)", outline: "none",
                      maxHeight: 120, lineHeight: 1.5,
                    }}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!text.trim() || sending}
                  style={{ padding: "9px 16px", background: text.trim() ? (isUrgent ? "#dc2626" : "#0f2942") : "#e2e8f0", color: text.trim() ? "#fff" : "#94a3b8", border: "none", borderRadius: 10, fontWeight: 700, cursor: text.trim() ? "pointer" : "not-allowed", flexShrink: 0, fontSize: 14 }}
                >
                  {sending ? "…" : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New conversation modal */}
      {showNewConv && (
        <NewConversationModal
          staff={staff}
          currentUserId={userId}
          onClose={() => setShowNewConv(false)}
          onStart={handleStartConversation}
        />
      )}
    </AppShell>
  );
}

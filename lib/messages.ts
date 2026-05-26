"use client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

import { supabase } from "./supabase";
import type { Conversation, Message } from "./types";

// ── Conversations ──────────────────────────────────────────────────────────────

export async function fetchConversationsForUser(userId: string): Promise<Conversation[]> {
  const { data: convs } = await supabase
    .from("conversations")
    .select("*")
    .contains("participants", [userId])
    .order("updated_at", { ascending: false });

  if (!convs?.length) return [];

  const convIds = (convs as Row[]).map((c) => c.id as string);

  const { data: lastMsgs } = await supabase
    .from("messages")
    .select("*")
    .in("conversation_id", convIds)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  const { data: readRows } = await supabase
    .from("message_read_status")
    .select("message_id")
    .eq("user_id", userId);

  const readSet = new Set(((readRows ?? []) as Row[]).map((r) => r.message_id as string));

  const allIds = [...new Set((convs as Row[]).flatMap((c) => c.participants as string[]))];
  const { data: staffRows } = await supabase
    .from("staff_accounts")
    .select("id, first_name, last_name, username")
    .in("id", allIds);

  const staffMap = new Map(
    ((staffRows ?? []) as Row[]).map((s) => [
      s.id as string,
      (`${s.first_name ?? ""} ${s.last_name ?? ""}`).trim() || (s.username as string),
    ])
  );

  return (convs as Row[]).map((c) => {
    const msgs = ((lastMsgs ?? []) as Row[]).filter((m) => m.conversation_id === c.id) as Message[];
    const lastMessage = msgs[0] ?? null;
    const unreadCount = msgs.filter((m) => m.sender_id !== userId && !readSet.has(m.id)).length;

    let otherParticipantName: string | undefined;
    if (c.type === "direct") {
      const otherId = (c.participants as string[]).find((p) => p !== userId);
      otherParticipantName = otherId ? (staffMap.get(otherId) ?? "Unknown") : undefined;
    }

    return {
      id: c.id as string,
      name: c.name as string | null,
      type: c.type as Conversation["type"],
      participants: c.participants as string[],
      created_by: c.created_by as string | undefined,
      created_at: c.created_at as string | undefined,
      updated_at: c.updated_at as string | undefined,
      lastMessage,
      unreadCount,
      otherParticipantName,
    };
  });
}

export async function findOrCreateDirectConversation(
  userId: string,
  otherId: string,
  _userDisplayName: string
): Promise<Conversation> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("type", "direct")
    .contains("participants", [userId])
    .contains("participants", [otherId]);

  if ((existing as Row[] | null)?.length) return (existing as Row[])[0] as unknown as Conversation;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ type: "direct", participants: [userId, otherId], created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Conversation;
}

export async function createGroupConversation(
  name: string,
  participants: string[],
  createdBy: string
): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ name, type: "group", participants, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Conversation;
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { data: convs } = await supabase
    .from("conversations")
    .select("id")
    .contains("participants", [userId]);

  if (!(convs as Row[] | null)?.length) return 0;
  const convIds = (convs as Row[]).map((c) => c.id as string);

  const { data: msgs } = await supabase
    .from("messages")
    .select("id")
    .in("conversation_id", convIds)
    .neq("sender_id", userId)
    .eq("is_deleted", false);

  if (!(msgs as Row[] | null)?.length) return 0;
  const msgIds = (msgs as Row[]).map((m) => m.id as string);

  const { data: read } = await supabase
    .from("message_read_status")
    .select("message_id")
    .eq("user_id", userId)
    .in("message_id", msgIds);

  const readSet = new Set(((read ?? []) as Row[]).map((r) => r.message_id as string));
  return msgIds.filter((id) => !readSet.has(id)).length;
}

// ── Messages ───────────────────────────────────────────────────────────────────

export async function fetchMessages(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<Message[]> {
  let q = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) q = q.lt("created_at", before);
  const { data } = await q;
  return ((data as Message[]) ?? []).reverse();
}

export async function sendMessage(
  msg: Omit<Message, "id" | "created_at">
): Promise<Message> {
  const { data, error } = await supabase.from("messages").insert(msg).select().single();
  if (error) throw error;
  return data as Message;
}

export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const { data: msgs } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .eq("is_deleted", false);

  if (!(msgs as Row[] | null)?.length) return;
  const allIds = (msgs as Row[]).map((m) => m.id as string);

  const { data: already } = await supabase
    .from("message_read_status")
    .select("message_id")
    .eq("user_id", userId)
    .in("message_id", allIds);

  const alreadyRead = new Set(((already ?? []) as Row[]).map((r) => r.message_id as string));
  const toInsert = allIds.filter((id) => !alreadyRead.has(id)).map((id) => ({ message_id: id, user_id: userId }));
  if (toInsert.length) await supabase.from("message_read_status").insert(toInsert);
}

export async function deleteMessage(messageId: string): Promise<void> {
  await supabase.from("messages").update({ is_deleted: true, content: "" }).eq("id", messageId);
}

// ── Staff picker ───────────────────────────────────────────────────────────────

export interface StaffPickerEntry {
  id: string;
  displayName: string;
  role: string;
  badge?: string;
}

export async function fetchStaffForMessaging(): Promise<StaffPickerEntry[]> {
  const { data } = await supabase
    .from("staff_accounts")
    .select("id, first_name, last_name, username, role, badge")
    .eq("active", true)
    .neq("role", "Volunteer")
    .order("last_name");

  return ((data as Row[]) ?? []).map((s) => ({
    id:          s.id          as string,
    displayName: (`${s.first_name ?? ""} ${s.last_name ?? ""}`).trim() || (s.username as string),
    role:        s.role        as string,
    badge:       s.badge       as string | undefined,
  }));
}

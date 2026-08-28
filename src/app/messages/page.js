"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../supabaseClient";

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function conversationTitle(conv, isMobile) {
  if (conv.type === "group") return conv.name || conv.participants.map(p => p.username).join(", ") || "Group chat";
  return conv.participants[0]?.username ? `@${conv.participants[0].username}` : "Unknown user";
}

function MessagesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toUsername = searchParams.get("to");

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const [composing, setComposing] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]); // for group chats
  const [groupName, setGroupName] = useState("");
  const [starting, setStarting] = useState(false);

  const channelRef = useRef(null);
  const messagesEndRef = useRef(null);
  const activeIdRef = useRef(null);
  activeIdRef.current = activeId;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.push("/"); return; }
      setUser(session.user);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user]);

  // Deep-link: /messages?to=username opens (or starts) a DM with that user
  useEffect(() => {
    if (!user || !toUsername) return;
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("id, username, profile_photo_url").eq("username", toUsername).single();
      if (!profile || profile.id === user.id) return;
      const id = await findOrCreateDirectConversation(profile);
      router.replace("/messages");
      if (id) openConversation(id);
    })();
  }, [user, toUsername]);

  async function loadConversations() {
    setConvLoading(true);
    try {
      const myId = user.id;
      const { data: myParts } = await supabase.from("conversation_participants").select("conversation_id, last_read_at").eq("user_id", myId);
      const convIds = (myParts || []).map(p => p.conversation_id);
      if (!convIds.length) { setConversations([]); return; }
      const readMap = {};
      (myParts || []).forEach(p => { readMap[p.conversation_id] = p.last_read_at; });

      const [{ data: convs }, { data: allParts }, { data: lastMsgs }] = await Promise.all([
        supabase.from("conversations").select("*").in("id", convIds),
        supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", convIds),
        supabase.from("messages").select("conversation_id, body, created_at, sender_id").in("conversation_id", convIds).order("created_at", { ascending: false }),
      ]);

      const otherUserIds = [...new Set((allParts || []).filter(p => p.user_id !== myId).map(p => p.user_id))];
      let profileMap = {};
      if (otherUserIds.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, username, profile_photo_url").in("id", otherUserIds);
        (profiles || []).forEach(p => { profileMap[p.id] = p; });
      }

      const lastByConv = {};
      (lastMsgs || []).forEach(m => { if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m; });

      const enriched = (convs || []).map(c => {
        const participants = (allParts || [])
          .filter(p => p.conversation_id === c.id && p.user_id !== myId)
          .map(p => profileMap[p.user_id]).filter(Boolean);
        const lastMessage = lastByConv[c.id] || null;
        const unread = !!(lastMessage && lastMessage.sender_id !== myId &&
          (!readMap[c.id] || new Date(lastMessage.created_at) > new Date(readMap[c.id])));
        return { ...c, participants, lastMessage, unread };
      });

      enriched.sort((a, b) => new Date(b.lastMessage?.created_at || b.created_at) - new Date(a.lastMessage?.created_at || a.created_at));
      setConversations(enriched);
    } catch (e) {
      console.error("Error loading conversations:", e);
    } finally {
      setConvLoading(false);
    }
  }

  async function findOrCreateDirectConversation(otherProfile) {
    const myId = user.id;
    const { data: myDirect } = await supabase
      .from("conversation_participants")
      .select("conversation_id, conversations!inner(type)")
      .eq("user_id", myId);
    const myDirectIds = (myDirect || [])
      .filter(r => r.conversations?.type === "direct")
      .map(r => r.conversation_id);

    if (myDirectIds.length) {
      const { data: shared } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", otherProfile.id)
        .in("conversation_id", myDirectIds);
      if (shared && shared.length) return shared[0].conversation_id;
    }

    const { data: newId, error } = await supabase.rpc("start_conversation", {
      other_user_ids: [otherProfile.id],
      conv_type: "direct",
    });
    if (error) { console.error("Error creating conversation:", error); return null; }
    await loadConversations();
    return newId;
  }

  async function handleSearch(q) {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    const { data } = await supabase
      .from("profiles").select("id, username, profile_photo_url")
      .ilike("username", `%${q.trim()}%`).neq("id", user.id).limit(10);
    setSearchResults((data || []).filter(p => !selectedUsers.some(s => s.id === p.id)));
  }

  function toggleSelectUser(p) {
    setSelectedUsers(prev => prev.some(s => s.id === p.id) ? prev.filter(s => s.id !== p.id) : [...prev, p]);
    setSearchResults(prev => prev.filter(r => r.id !== p.id));
    setSearch("");
  }

  async function handleStartConversation() {
    if (!selectedUsers.length) return;
    setStarting(true);
    try {
      let id;
      if (selectedUsers.length === 1) {
        id = await findOrCreateDirectConversation(selectedUsers[0]);
      } else {
        const { data: newId, error } = await supabase.rpc("start_conversation", {
          other_user_ids: selectedUsers.map(u => u.id),
          conv_type: "group",
          conv_name: groupName.trim() || null,
        });
        if (error) throw error;
        await loadConversations();
        id = newId;
      }
      setComposing(false); setSelectedUsers([]); setGroupName(""); setSearch(""); setSearchResults([]);
      if (id) openConversation(id);
    } catch (e) {
      console.error("Error starting conversation:", e);
    } finally {
      setStarting(false);
    }
  }

  async function openConversation(id) {
    setActiveId(id);
    setMessagesLoading(true);
    setComposing(false);
    try {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true });
      setMessages(data || []);
      await supabase.from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", id).eq("user_id", user.id);
      setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: false } : c));
    } catch (e) {
      console.error("Error loading messages:", e);
    } finally {
      setMessagesLoading(false);
    }

    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`conversation-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, (payload) => {
        setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
        if (payload.new.sender_id !== user.id && activeIdRef.current === id) {
          supabase.from("conversation_participants").update({ last_read_at: new Date().toISOString() })
            .eq("conversation_id", id).eq("user_id", user.id);
        } else if (payload.new.sender_id !== user.id) {
          setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: true, lastMessage: payload.new } : c));
        }
      })
      .subscribe();
  }

  useEffect(() => {
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!body.trim() || !activeId) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    const optimistic = { id: `temp-${Date.now()}`, conversation_id: activeId, sender_id: user.id, body: text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    try {
      const { data, error } = await supabase.from("messages")
        .insert({ conversation_id: activeId, sender_id: user.id, body: text })
        .select().single();
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m));
      setConversations(prev => {
        const updated = prev.map(c => c.id === activeId ? { ...c, lastMessage: data } : c);
        updated.sort((a, b) => new Date(b.lastMessage?.created_at || b.created_at) - new Date(a.lastMessage?.created_at || a.created_at));
        return updated;
      });
    } catch (e) {
      console.error("Send error:", e);
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }

  const inp = { width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "#FAFAF9", fontFamily: "inherit" };
  const active = conversations.find(c => c.id === activeId);
  const showList = !isMobile || (isMobile && !activeId && !composing);
  const showThread = !isMobile || (isMobile && (activeId || composing));

  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif", color: "#bbb" }}>Loading...</div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#FAFAF9", color: "#1a1a1a", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
        input, textarea, button { font-family: inherit; }
      `}</style>

      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", flexShrink: 0 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <button onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Cruiser</span>
          </button>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#555", cursor: "pointer" }}>
            ← All Meets
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: "0 auto", width: "100%", flex: 1, display: "flex", overflow: "hidden", border: isMobile ? "none" : "1px solid #ECEAE6", borderTop: "none" }}>

        {/* CONVERSATION LIST */}
        {showList && (
          <div style={{ width: isMobile ? "100%" : 320, flexShrink: 0, borderRight: isMobile ? "none" : "1px solid #ECEAE6", display: "flex", flexDirection: "column", background: "white" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #F0EFEB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Messages</span>
              <button onClick={() => { setComposing(true); setActiveId(null); }}
                style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                + New
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {convLoading ? (
                <div style={{ padding: 20, color: "#aaa", fontSize: 13, textAlign: "center" }}>Loading...</div>
              ) : conversations.length === 0 ? (
                <div style={{ padding: 24, color: "#aaa", fontSize: 13, textAlign: "center" }}>No conversations yet. Start one with "+ New".</div>
              ) : conversations.map(c => {
                const other = c.participants[0];
                return (
                  <button key={c.id} onClick={() => openConversation(c.id)}
                    style={{
                      display: "flex", gap: 10, alignItems: "center", width: "100%", textAlign: "left",
                      padding: "12px 16px", background: activeId === c.id ? "#F5F5F3" : "transparent",
                      border: "none", borderBottom: "1px solid #F8F7F5", cursor: "pointer",
                    }}>
                    {other?.profile_photo_url || c.type === "direct"
                      ? (other?.profile_photo_url
                          ? <img src={other.profile_photo_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          : <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#E8E8E4", display: "grid", placeItems: "center", color: "#555", fontWeight: 600, flexShrink: 0 }}>{(other?.username || "?")[0]?.toUpperCase()}</div>)
                      : <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1a1a1a", display: "grid", placeItems: "center", color: "white", fontWeight: 600, flexShrink: 0 }}>{(c.name || "G")[0]?.toUpperCase()}</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: c.unread ? 700 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conversationTitle(c)}</span>
                        {c.lastMessage && <span style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>{timeAgo(c.lastMessage.created_at)}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: c.unread ? "#1a1a1a" : "#999", fontWeight: c.unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.lastMessage ? (c.lastMessage.sender_id === user.id ? "You: " : "") + c.lastMessage.body : "No messages yet"}
                      </div>
                    </div>
                    {c.unread && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#E11D48", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* THREAD / COMPOSE */}
        {showThread && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#FAFAF9" }}>
            {composing ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #ECEAE6", display: "flex", alignItems: "center", gap: 10, background: "white" }}>
                  {isMobile && (
                    <button onClick={() => setComposing(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}>←</button>
                  )}
                  <span style={{ fontSize: 14, fontWeight: 700 }}>New message</span>
                </div>
                <div style={{ padding: 16 }}>
                  {selectedUsers.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {selectedUsers.map(u => (
                        <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F0EFEB", borderRadius: 100, padding: "5px 10px", fontSize: 12 }}>
                          @{u.username}
                          <button onClick={() => setSelectedUsers(prev => prev.filter(s => s.id !== u.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 13, padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search by username..." style={inp} />
                  {searchResults.length > 0 && (
                    <div style={{ marginTop: 8, border: "1.5px solid #E8E8E4", borderRadius: 10, overflow: "hidden", background: "white" }}>
                      {searchResults.map(p => (
                        <div key={p.id} onClick={() => toggleSelectUser(p)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #F0EFEB" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#F8F7F5"} onMouseLeave={e => e.currentTarget.style.background = "white"}>
                          {p.profile_photo_url
                            ? <img src={p.profile_photo_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                            : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#E8E8E4", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600, color: "#555" }}>{p.username[0].toUpperCase()}</div>}
                          <span style={{ fontSize: 13, fontWeight: 600 }}>@{p.username}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedUsers.length > 1 && (
                    <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name (optional)" style={{ ...inp, marginTop: 10 }} />
                  )}
                  <button onClick={handleStartConversation} disabled={!selectedUsers.length || starting}
                    style={{ marginTop: 14, background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: !selectedUsers.length || starting ? 0.5 : 1 }}>
                    {starting ? "Starting..." : selectedUsers.length > 1 ? "Start group chat" : "Start conversation"}
                  </button>
                </div>
              </div>
            ) : !active ? (
              <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#bbb", fontSize: 14 }}>Select a conversation</div>
            ) : (
              <>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #ECEAE6", display: "flex", alignItems: "center", gap: 10, background: "white", flexShrink: 0 }}>
                  {isMobile && (
                    <button onClick={() => setActiveId(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}>←</button>
                  )}
                  {active.type === "direct" && active.participants[0]?.username ? (
                    <button onClick={() => router.push(`/u/${active.participants[0].username}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>
                      {conversationTitle(active)}
                    </button>
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{conversationTitle(active)}</span>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  {messagesLoading ? (
                    <div style={{ textAlign: "center", color: "#aaa", fontSize: 13 }}>Loading...</div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, marginTop: 20 }}>No messages yet. Say hi!</div>
                  ) : messages.map(m => {
                    const mine = m.sender_id === user.id;
                    return (
                      <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "70%", padding: "9px 14px", borderRadius: 16,
                          background: mine ? "#1a1a1a" : "white",
                          color: mine ? "white" : "#1a1a1a",
                          border: mine ? "none" : "1.5px solid #E8E8E4",
                          fontSize: 14, lineHeight: 1.45, wordBreak: "break-word",
                        }}>
                          {m.body}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSend} style={{ display: "flex", gap: 8, padding: 14, borderTop: "1px solid #ECEAE6", background: "white", flexShrink: 0 }}>
                  <input value={body} onChange={e => setBody(e.target.value)} placeholder="Message..." style={{ ...inp, flex: 1 }} />
                  <button type="submit" disabled={!body.trim() || sending}
                    style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: !body.trim() || sending ? 0.5 : 1 }}>
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesInner />
    </Suspense>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IoAttachOutline, IoArrowBackOutline, IoDownloadOutline, IoSendOutline } from "react-icons/io5";
import { MdSupportAgent } from "react-icons/md";
import { Navigate } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { Loader } from "../components/Loader";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { api, type SupportAttachment, type SupportConversation, type SupportMessage } from "../services/api";

function AttachmentItem({ file }: { file: SupportAttachment }) {
  const { t } = useLocale();
  const [url, setUrl] = useState<string>();
  useEffect(() => { let active = true; let objectUrl: string | undefined; void api.supportAttachment(file.id).then(blob => { objectUrl = URL.createObjectURL(blob); if (active) setUrl(objectUrl); else URL.revokeObjectURL(objectUrl); }).catch(() => {}); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [file.id]);
  return <a href={url} target="_blank" rel="noreferrer" download={file.fileName} className="support-attachment">{url && file.contentType.startsWith("image/") ? <img src={url} alt={file.fileName} /> : <IoDownloadOutline aria-hidden="true" />}<span>{file.fileName}</span><small>{url ? t("support.download") : "…"}</small></a>;
}

function AttachmentList({ attachments }: { attachments: SupportAttachment[] }) {
  return <div className="support-attachments">{attachments.map(file => <AttachmentItem key={file.id} file={file} />)}</div>;
}

function MessageList({ messages, currentUserId }: { messages: SupportMessage[]; currentUserId: string }) {
  const { t, locale } = useLocale();
  return <div className="support-message-list">{messages.map(message => <article key={message.id} className={`support-message${message.sender.id === currentUserId ? " support-message--own" : ""}`}><div className="support-message__meta"><strong>{message.sender.id === currentUserId ? t("support.you") : message.sender.role === "ADMIN" ? t("support.admin") : message.sender.name}</strong><time>{new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(message.createdAt))}</time></div>{message.body && <p>{message.body}</p>}<AttachmentList attachments={message.attachments} /></article>)}</div>;
}

function Composer({ conversationId, admin = false, onSent }: { conversationId?: string; admin?: boolean; onSent: () => void }) {
  const { t } = useLocale();
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const mutation = useMutation({ mutationFn: () => admin && conversationId ? api.sendAdminSupportMessage(conversationId, body, files) : api.sendSupportMessage(body, files), onSuccess: () => { setBody(""); setFiles([]); onSent(); void client.invalidateQueries({ queryKey: ["support"] }); } });
  const addFiles = (incoming: FileList | null) => { if (!incoming) return; setFiles(current => [...current, ...Array.from(incoming)].slice(0, 5)); };
  return <form className="support-composer" onSubmit={event => { event.preventDefault(); mutation.mutate(); }}>
    {files.length > 0 && <ul className="support-file-queue">{files.map((file, index) => <li key={`${file.name}-${index}`}>{file.name}<button type="button" aria-label={t("support.removeFile")} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}>×</button></li>)}</ul>}
    {mutation.isError && <p className="support-error">{mutation.error.message || t("error.generic")}</p>}
    <p className="support-composer__hint">{t("support.fileLimit")}</p>
    <div className="support-composer__row"><label className="button button--secondary support-attach"><IoAttachOutline aria-hidden="true" /><span>{t("support.attach")}</span><input type="file" multiple accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.odt,.ods" onChange={event => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label><textarea value={body} onChange={event => setBody(event.target.value)} maxLength={4000} rows={2} placeholder={t("support.messagePlaceholder")} /><button className="button" type="submit" disabled={mutation.isPending || (!body.trim() && !files.length)}><IoSendOutline aria-hidden="true" />{t("support.send")}</button></div>
  </form>;
}

function ConversationChat({ conversation, currentUserId, admin = false, onBack, onSent }: { conversation: SupportConversation; currentUserId: string; admin?: boolean; onBack?: () => void; onSent: () => void }) {
  const query = useQuery({ queryKey: ["support", "messages", conversation.id], queryFn: () => api.adminSupportMessages(conversation.id), enabled: admin, refetchInterval: 10000 });
  const messages = admin ? query.data?.messages ?? conversation.messages : conversation.messages;
  return <section className="support-chat">
    <header className="support-chat__header">{onBack && <button className="button button--secondary support-back" onClick={onBack}><IoArrowBackOutline aria-hidden="true" />{" "}</button>}<Avatar name={conversation.user.name} src={conversation.user.avatarUrl} size="sm" /><div><h2>{admin ? conversation.user.name : "Fantasy Futsal"}</h2>{admin && <p>{conversation.user.email}</p>}</div></header>
    <MessageList messages={messages} currentUserId={currentUserId} />
    <Composer conversationId={conversation.id} admin={admin} onSent={onSent} />
  </section>;
}

export function SupportPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["support", "conversation"], queryFn: api.supportConversation, refetchInterval: 10000 });
  const blankConversation = useMemo<SupportConversation>(() => ({ id: "", lastMessageAt: new Date().toISOString(), user: { id: user?.id ?? "", name: user?.name ?? "", email: "", avatarUrl: user?.avatarUrl ?? null }, messages: [] }), [user?.avatarUrl, user?.id, user?.name]);
  if (user?.role === "ADMIN") return <Navigate to="/admin/support" replace />;
  return <div className="page page--narrow support-page"><header className="page-heading"><h1><MdSupportAgent aria-hidden="true" /> {t("support.title")}</h1><p className="muted">{t("support.description")}</p></header>{query.isPending ? <div className="state-card"><Loader label={t("loading.app")} /></div> : query.isError ? <p className="state-card state-card--error">{t("error.generic")}</p> : <ConversationChat conversation={query.data ?? blankConversation} currentUserId={user?.id ?? ""} onSent={() => { void client.invalidateQueries({ queryKey: ["support", "conversation"] }); }} />}</div>;
}

export function AdminSupportPage() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inbox = useQuery({ queryKey: ["support", "inbox"], queryFn: api.adminSupportConversations, refetchInterval: 10000 });
  const selected = inbox.data?.find(item => item.id === selectedId) ?? null;
  const detail = useQuery({ queryKey: ["support", "messages", selectedId], queryFn: () => api.adminSupportMessages(selectedId!), enabled: Boolean(selectedId), refetchInterval: 10000 });
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  const refresh = () => { void client.invalidateQueries({ queryKey: ["support"] }); };
  return <div className="page support-page support-admin-page"><header className="page-heading"><h1><MdSupportAgent aria-hidden="true" /> {t("support.adminInbox")}</h1></header><div className={`support-layout${selectedId ? " support-layout--selected" : ""}`}>
    <aside className="support-inbox"><h2>{t("support.adminInbox")}</h2>{inbox.isPending ? <Loader label={t("loading.app")} /> : inbox.isError ? <p>{t("error.generic")}</p> : inbox.data?.length ? inbox.data.map(conversation => { const last = conversation.messages[0]; return <button type="button" key={conversation.id} className={`support-inbox__item${conversation.id === selectedId ? " is-active" : ""}`} onClick={() => setSelectedId(conversation.id)}><Avatar name={conversation.user.name} src={conversation.user.avatarUrl} size="sm" /><span className="support-inbox__info"><strong>{conversation.user.name}</strong><small>{conversation.user.email}</small><small>{last?.body || last?.attachments.map(file => file.fileName).join(", ")}</small></span>{Boolean(conversation.unreadCount) && <b>{conversation.unreadCount}</b>}<time>{new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(conversation.lastMessageAt))}</time></button>; }) : <p className="muted">{t("support.noConversations")}</p>}</aside>
    <div className="support-admin-chat">{selected ? detail.isPending ? <Loader label={t("loading.app")} /> : detail.isError ? <p>{t("error.generic")}</p> : <ConversationChat conversation={detail.data ?? selected} currentUserId={user?.id ?? ""} admin onBack={() => setSelectedId(null)} onSent={refresh} /> : <p className="state-card">{t("support.selectConversation")}</p>}</div>
  </div></div>;
}


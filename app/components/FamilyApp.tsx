"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { subscribeToPush } from "@/lib/push";

const T = {
  bg0:"#F5EFE6", bg1:"#FFFFFF", bg2:"#F0E9DF", bg3:"#EAE2D6", bg4:"#E2D8CA",
  line:"#DDD5C8", line2:"#C9BFB0", line3:"#B8AC9C",
  txt0:"#2C1F14", txt1:"#7A6555", txt2:"#A8937E",
  red:"#C8522A",   redT:"rgba(200,82,42,0.10)",   redB:"rgba(200,82,42,0.25)",
  blue:"#3A6DBF",  blueT:"rgba(58,109,191,0.10)",  blueB:"rgba(58,109,191,0.25)",
  green:"#3D8C6E", greenT:"rgba(61,140,110,0.10)", greenB:"rgba(61,140,110,0.25)",
  amber:"#C47B0A", amberT:"rgba(196,123,10,0.10)", amberB:"rgba(196,123,10,0.25)",
} as const;

type UIMember = {
  id: string;
  name: string;
  avatar: string;
  photo: string | null;
  color: string;
  role: string;
};

const TODAY_ISO = new Date().toISOString().slice(0, 10);
const THIS_YEAR = new Date().getFullYear();

function parseEventDate(str: string): string|null {
  if (!str || str === "Heute" || str === "heute") return TODAY_ISO;
  const months: Record<string,number> = {Jan:1,Feb:2,Mär:3,Apr:4,Mai:5,Jun:6,Jul:7,Aug:8,Sep:9,Okt:10,Nov:11,Dez:12};
  const m = str.match(/(\d+)\.\s*(\w+)/);
  if (!m) return null;
  const day = parseInt(m[1]);
  const mon = months[m[2]];
  if (!mon) return null;
  return `${THIS_YEAR}-${String(mon).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function postHeaderFromCreated(createdAt: string): { date: string; time: string } {
  const d = new Date(createdAt);
  const ymd = localYmd(d);
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false });
  const now = new Date();
  const today = localYmd(now);
  const yester = new Date(now);
  yester.setDate(yester.getDate() - 1);
  const ymdY = localYmd(yester);
  let dateLabel: string;
  if (ymd === today) dateLabel = "heute";
  else if (ymd === ymdY) dateLabel = "gestern";
  else dateLabel = d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
  return { date: dateLabel, time };
}

function mapDbMember(row: {
  id: string;
  name: string;
  avatar: string | null;
  color: string | null;
  role: string | null;
  photo_url: string | null;
}): UIMember {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar || "👤",
    photo: row.photo_url,
    color: row.color || T.red,
    role: row.role || "",
  };
}

function formatEventDateLabel(iso: string | null): string {
  if (!iso) return "Demnächst";
  if (iso === TODAY_ISO) return "Heute";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
}

function formatDbTime(t: string | null | undefined): string {
  if (!t) return "–";
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

type EventRecurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";

function normalizeRecurrence(v: string | null | undefined): EventRecurrence {
  if (v === "daily" || v === "weekly" || v === "monthly" || v === "yearly") return v;
  return "none";
}

function compareIso(a: string, b: string): number {
  return a.localeCompare(b);
}

function maxIso(a: string, b: string): string {
  return compareIso(a, b) >= 0 ? a : b;
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return localYmd(d);
}

function isoWeekdayMon0(iso: string): number {
  const d = new Date(iso + "T12:00:00");
  return (d.getDay() + 6) % 7;
}

/** True if a recurring (or one-off) series anchored at `anchorIso` occurs on calendar day `iso` (YYYY-MM-DD). */
function eventOccursOn(iso: string, anchorIso: string, recurrence: EventRecurrence): boolean {
  if (!anchorIso) return false;
  if (compareIso(iso, anchorIso) < 0) return false;
  if (recurrence === "none") return iso === anchorIso;
  const a = new Date(anchorIso + "T12:00:00");
  const t = new Date(iso + "T12:00:00");
  switch (recurrence) {
    case "daily":
      return true;
    case "weekly":
      return isoWeekdayMon0(iso) === isoWeekdayMon0(anchorIso);
    case "monthly":
      return t.getDate() === a.getDate();
    case "yearly":
      return t.getMonth() === a.getMonth() && t.getDate() === a.getDate();
    default:
      return false;
  }
}

const UPCOMING_OCCURRENCE_HORIZON_DAYS = 400;

function expandMemberUpcomingOccurrences(raw: any[], fromIso: string): any[] {
  const endIso = addDaysIso(fromIso, UPCOMING_OCCURRENCE_HORIZON_DAYS);
  const out: any[] = [];
  for (const ev of raw) {
    const anchor = ev.isoDate as string | null | undefined;
    if (!anchor) continue;
    const rec = normalizeRecurrence(ev.recurrence);
    if (rec === "none") {
      if (compareIso(anchor, fromIso) >= 0 && compareIso(anchor, endIso) <= 0) {
        out.push({ ...ev, occurrenceIso: anchor, date: formatEventDateLabel(anchor) });
      }
      continue;
    }
    let d = maxIso(fromIso, anchor);
    while (compareIso(d, endIso) <= 0) {
      if (eventOccursOn(d, anchor, rec)) {
        out.push({ ...ev, occurrenceIso: d, date: formatEventDateLabel(d) });
      }
      d = addDaysIso(d, 1);
    }
  }
  out.sort(
    (a, b) =>
      compareIso(a.occurrenceIso, b.occurrenceIso) || String(a.time).localeCompare(String(b.time))
  );
  return out;
}

const RECURRENCE_OPTIONS: { id: EventRecurrence; label: string }[] = [
  { id: "none", label: "Einmalig" },
  { id: "daily", label: "Täglich" },
  { id: "weekly", label: "Wöchentlich" },
  { id: "monthly", label: "Monatlich" },
  { id: "yearly", label: "Jährlich" },
];

/** Shareable join links from the Familie tab (matches production app URL). */
const MEMBER_INVITE_APP_BASE = "https://familyfeed-app.vercel.app";

function randomInviteToken(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

const STORY_BG_OPTIONS = [
  "#C8522A","#8B3A20","#3A6DBF","#1E4A99","#3D8C6E","#2A6B50",
  "#C47B0A","#8B560A","#7B4F8E","#4A3060","#C44A6B","#8B2A45",
];

const TYPE: Record<string,{label:string,sym:string,color:string,bg:string,border:string}> = {
  status:   { label:"Status",     sym:"●", color:T.red,   bg:T.redT,   border:T.redB   },
  event:    { label:"Termin",     sym:"◆", color:T.blue,  bg:T.blueT,  border:T.blueB  },
  reminder: { label:"Erinnerung", sym:"▲", color:T.amber, bg:T.amberT, border:T.amberB },
};

function Av({ m, s=40 }: { m:any, s?:number }) {
  if (!m) return <div style={{ width:s, height:s, borderRadius:"50%", background:T.bg3, flexShrink:0 }} />;
  const base: React.CSSProperties = { width:s, height:s, borderRadius:"50%", flexShrink:0, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center" };
  if (m.photo) return <img src={m.photo} alt={m.name} style={{...base, objectFit:"cover"}} />;
  return <div style={{...base, background:m.color+"18", border:`1.5px solid ${m.color}33`, fontSize:s*0.46}}>{m.avatar}</div>;
}

function Chip({ type }: { type:string }) {
  const t = TYPE[type];
  return <span style={{ fontSize:9, fontWeight:700, color:t.color, background:t.bg, border:`1px solid ${t.border}`, borderRadius:4, padding:"2px 6px", textTransform:"uppercase", letterSpacing:0.5 }}>{t.sym} {t.label}</span>;
}

function SLabel({ children }: { children:React.ReactNode }) {
  return <div style={{fontSize:9,fontWeight:700,color:T.txt2,textTransform:"uppercase",letterSpacing:1.2,marginBottom:7}}>{children}</div>;
}function StoryPhotoUpload({ photo, onPhoto }: { photo:string|null, onPhoto:(p:string|null)=>void }) {
  const ref = useRef<HTMLInputElement>(null);
  const handleFile = (f: File) => {
    const r = new FileReader();
    r.onload = e => onPhoto(e.target?.result as string);
    r.readAsDataURL(f);
  };
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])}/>
      {photo
        ? <div style={{display:"flex",gap:8}}>
            <button onClick={()=>ref.current?.click()} style={{flex:1,padding:"9px",borderRadius:10,background:T.bg3,color:T.txt1,fontWeight:600,fontSize:13,border:`1px solid ${T.line}`,cursor:"pointer"}}>Anderes Foto</button>
            <button onClick={()=>onPhoto(null)} style={{flex:1,padding:"9px",borderRadius:10,background:T.redT,color:T.red,fontWeight:600,fontSize:13,border:`1px solid ${T.redB}`,cursor:"pointer"}}>Entfernen</button>
          </div>
        : <button onClick={()=>ref.current?.click()} style={{width:"100%",padding:"14px",borderRadius:12,background:T.bg3,border:`2px dashed ${T.line2}`,color:T.txt1,fontWeight:600,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}}>
            <span style={{fontSize:20}}>📷</span> Foto auswählen
          </button>
      }
    </div>
  );
}

function PhotoPanel({ m, onUpload, onRemove, onClose }: { m:any, onUpload:(f:File)=>void, onRemove:()=>void, onClose:()=>void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{background:T.bg2,borderTop:`1px solid ${T.line}`,padding:"12px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:9}}>
        <span style={{fontSize:11,fontWeight:600,color:T.txt1}}>Foto für {m.name}</span>
        <button onClick={onClose} style={{fontSize:12,color:T.txt2,cursor:"pointer",background:"none",border:"none"}}>✕</button>
      </div>
      <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files?.[0]&&onUpload(e.target.files[0])}/>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>ref.current?.click()} style={{flex:1,background:T.red,borderRadius:7,padding:"8px",color:"#fff",fontWeight:600,fontSize:12,border:"none",cursor:"pointer"}}>Foto wählen</button>
        {m.photo&&<button onClick={onRemove} style={{flex:1,background:T.redT,border:`1px solid ${T.redB}`,borderRadius:7,padding:"8px",color:T.red,fontWeight:600,fontSize:12,cursor:"pointer"}}>Entfernen</button>}
      </div>
    </div>
  );
}

function PostCard({ post, gm, active, expanded, onExpand, onRead, comment, onCommentChange, onComment, onDelete }:
  { post:any, gm:(id:string)=>UIMember|undefined, active:string, expanded:boolean, onExpand:()=>void, onRead:()=>void, comment:string, onCommentChange:(s:string)=>void, onComment:()=>void, onDelete?:()=>void }) {
  const mem  = gm(post.memberId);
  const read = post.reads.includes(active);
  const tc   = TYPE[post.type];
  return (
    <div style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:14,overflow:"hidden",position:"relative"}}>
      {onDelete ? (
        <button
          type="button"
          className="r"
          onClick={() => {
            if (window.confirm("Post wirklich löschen?")) onDelete();
          }}
          aria-label="Post löschen"
          style={{
            position: "absolute",
            top: post.pinned ? 30 : 8,
            right: 8,
            zIndex: 2,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: T.bg3,
            border: `1px solid ${T.line}`,
            color: T.txt2,
            fontSize: 14,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          ✕
        </button>
      ) : null}
      {post.pinned&&<div style={{background:T.redT,borderBottom:`1px solid ${T.redB}`,padding:"4px 13px",display:"flex",gap:4,alignItems:"center"}}><span style={{fontSize:9,color:T.red}}>▲</span><span style={{fontSize:9,color:T.red,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase"}}>Angepinnt</span></div>}
      <div style={{display:"flex",gap:9,padding:"12px 13px 9px",alignItems:"center"}}>
        <Av m={mem} s={38}/>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:T.txt0}}>{mem?.name}</div>
          <div style={{fontSize:10,color:T.txt2,marginTop:1,fontFamily:"monospace"}}>{post.date==="heute"?`Heute · ${post.time}`:`${post.date} · ${post.time}`}</div>
        </div>
        <Chip type={post.type}/>
      </div>
      <div style={{padding:"0 13px 11px"}}>
        <div style={{fontSize:14,lineHeight:1.58,color:T.txt0}}>{post.content}</div>
        {post.eventDate&&<div style={{marginTop:9,background:T.amberT,border:`1px solid ${T.amberB}`,borderRadius:8,padding:"8px 11px",display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:16,flexShrink:0}}>◆</span><div style={{fontSize:12,fontWeight:600,color:T.amber}}>{post.eventDate} · {post.eventTime} Uhr</div></div>}
      </div>
      {post.reads.length>0&&<div style={{padding:"0 13px 9px",display:"flex",alignItems:"center",gap:5}}><div style={{display:"flex"}}>{post.reads.slice(0,4).map((rid:string)=><div key={rid} style={{width:18,height:18,borderRadius:"50%",overflow:"hidden",marginLeft:-3,border:`1.5px solid ${T.bg1}`}}><Av m={gm(rid)} s={18}/></div>)}</div><span style={{fontSize:10,color:T.txt2,fontFamily:"monospace"}}>{post.reads.length} gelesen</span></div>}
      <div style={{display:"flex",gap:5,padding:"7px 9px",borderTop:`1px solid ${T.line}`}}>
        <button onClick={onRead} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"7px 8px",borderRadius:7,background:read?T.greenT:T.bg3,border:`1px solid ${read?T.greenB:T.line}`,color:read?T.green:T.txt1,fontWeight:600,fontSize:12,cursor:"pointer"}}>
          <span style={{fontSize:13}}>{read?"✓":"○"}</span>{read?"Gelesen":"Als gelesen markieren"}
        </button>
        <button onClick={onExpand} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"7px 11px",borderRadius:7,background:expanded?T.redT:T.bg3,border:`1px solid ${expanded?T.redB:T.line}`,color:expanded?T.red:T.txt1,fontWeight:600,fontSize:12,cursor:"pointer"}}>
          <span style={{fontSize:13}}>◎</span>{post.comments.length>0?post.comments.length:""}
        </button>
      </div>
      {expanded&&<div style={{borderTop:`1px solid ${T.line}`,padding:"11px 13px",background:T.bg2}}>
        {post.comments.map((c:any,i:number)=>{
          const cm=gm(c.memberId);
          return <div key={i} style={{display:"flex",gap:7,marginBottom:9}}><Av m={cm} s={26}/><div style={{flex:1}}><div style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:"2px 9px 9px 9px",padding:"6px 10px"}}><div style={{fontSize:9,fontWeight:700,color:cm?.color,marginBottom:2,textTransform:"uppercase"}}>{cm?.name}</div><div style={{fontSize:12,color:T.txt0,lineHeight:1.4}}>{c.text}</div></div><div style={{fontSize:9,color:T.txt2,marginTop:2,marginLeft:4,fontFamily:"monospace"}}>{c.time}</div></div></div>;
        })}
        <div style={{display:"flex",gap:7,marginTop:5}}>
          <Av m={gm(active)} s={26}/>
          <input value={comment} onChange={e=>onCommentChange(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onComment()} placeholder="Kommentar..." style={{flex:1,background:T.bg1,border:`1px solid ${T.line2}`,borderRadius:16,padding:"6px 12px",fontSize:12,color:T.txt0}}/>
          <button onClick={onComment} style={{width:30,height:30,borderRadius:"50%",background:T.red,color:"#fff",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"none",cursor:"pointer"}}>↑</button>
        </div>
      </div>}
    </div>
  );
}

function FamilyApp() {
  const router = useRouter();
  const pushSetupDoneRef = useRef(false);
  const [tab, setTab] = useState("dashboard");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [members, setMembers] = useState<UIMember[]>([]);
  const [memberEvents, setMemberEvents] = useState<Record<string, any[]>>({});
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<Record<string, any[]>>({});
  const [viewStory, setViewStory] = useState<{ memberId: string; index: number } | null>(null);
  const [addStory, setAddStory] = useState(false);
  const [newStory, setNewStory] = useState({
    type: "text",
    text: "",
    bg: STORY_BG_OPTIONS[0],
    photo: null as string | null,
  });
  const [compose, setCompose] = useState(false);
  const [newPost, setNewPost] = useState({ content: "", type: "status", memberId: "" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [currentMember, setCurrentMember] = useState("");
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [addEventModal, setAddEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    time: "",
    icon: "📅",
    forMemberId: "",
    recurrence: "none" as EventRecurrence,
  });
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({ text: "", qty: "", cat: "🛒" });
  const [shopFilter, setShopFilter] = useState("all");
  const [calMonth, setCalMonth] = useState(new Date());
  const [calSelected, setCalSelected] = useState(TODAY_ISO);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [memberInviteModal, setMemberInviteModal] = useState(false);
  const [memberInviteLink, setMemberInviteLink] = useState("");
  const [memberInviteLoading, setMemberInviteLoading] = useState(false);
  const [memberInviteError, setMemberInviteError] = useState<string | null>(null);
  const [memberInviteCopied, setMemberInviteCopied] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [settingsNotifFeedback, setSettingsNotifFeedback] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");

  const loadFamilyData = useCallback(async () => {
    setLoadError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserEmail(user.email ?? "");
    const { data: fam, error: famErr } = await supabase
      .from("families")
      .select("id")
      .eq("created_by", user.id)
      .maybeSingle();
    if (famErr) {
      setLoadError(famErr.message);
      setLoading(false);
      return;
    }
    if (!fam?.id) {
      setLoadError("Keine Familie gefunden.");
      setLoading(false);
      return;
    }
    setFamilyId(fam.id);
    const { data: memRows, error: memErr } = await supabase
      .from("members")
      .select("id, name, avatar, color, role, photo_url")
      .eq("family_id", fam.id)
      .order("created_at", { ascending: true });
    if (memErr) {
      setLoadError(memErr.message);
      setLoading(false);
      return;
    }
    const memList = (memRows || []).map(mapDbMember);
    setMembers(memList);
    const firstId = memList[0]?.id ?? "";
    setCurrentMember((prev) => (prev && memList.some((m) => m.id === prev) ? prev : firstId));
    setNewPost((p) => ({ ...p, memberId: p.memberId && memList.some((m) => m.id === p.memberId) ? p.memberId : firstId }));
    setNewEvent((e) => ({ ...e, forMemberId: e.forMemberId && memList.some((m) => m.id === e.forMemberId) ? e.forMemberId : firstId }));
    const memberIds = memList.map((m) => m.id);
    if (memberIds.length === 0) {
      setPosts([]);
      setMemberEvents({});
      setStories({});
      setShopItems([]);
      setLoading(false);
      return;
    }
    const { data: postRows, error: postErr } = await supabase
      .from("posts")
      .select("id, member_id, type, content, pinned, date, time, created_at, event_date, event_time")
      .in("member_id", memberIds)
      .order("created_at", { ascending: false });
    if (postErr) {
      setLoadError(postErr.message);
      setLoading(false);
      return;
    }
    const postList = postRows || [];
    const postIds = postList.map((p) => p.id);
    let commentRows: { id: string; post_id: string; member_id: string; text: string; created_at: string }[] = [];
    let readRows: { post_id: string; member_id: string }[] = [];
    if (postIds.length > 0) {
      const [cRes, rRes] = await Promise.all([
        supabase.from("comments").select("id, post_id, member_id, text, created_at").in("post_id", postIds),
        supabase.from("post_reads").select("post_id, member_id").in("post_id", postIds),
      ]);
      if (cRes.error) {
        setLoadError(cRes.error.message);
        setLoading(false);
        return;
      }
      if (rRes.error) {
        setLoadError(rRes.error.message);
        setLoading(false);
        return;
      }
      commentRows = cRes.data || [];
      readRows = rRes.data || [];
    }
    const commentsByPost = new Map<string, typeof commentRows>();
    for (const c of commentRows) {
      const arr = commentsByPost.get(c.post_id) || [];
      arr.push(c);
      commentsByPost.set(c.post_id, arr);
    }
    const readsByPost = new Map<string, string[]>();
    for (const r of readRows) {
      const arr = readsByPost.get(r.post_id) || [];
      arr.push(r.member_id);
      readsByPost.set(r.post_id, arr);
    }
    const uiPosts = postList.map((row) => {
      const header = postHeaderFromCreated(row.created_at);
      const evDate =
        row.event_date &&
        new Date(String(row.event_date) + "T12:00:00").toLocaleDateString("de-DE", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
      const evTime = row.event_time ? formatDbTime(row.event_time) : undefined;
      const cs = (commentsByPost.get(row.id) || []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      return {
        id: row.id,
        memberId: row.member_id,
        type: row.type,
        pinned: row.pinned,
        date: header.date,
        time: header.time,
        reads: readsByPost.get(row.id) || [],
        comments: cs.map((c) => ({
          memberId: c.member_id,
          text: c.text,
          time: new Date(c.created_at).toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
        })),
        content: row.content || "",
        eventDate: row.type !== "status" && evDate ? evDate : undefined,
        eventTime: row.type !== "status" && evTime ? evTime : undefined,
      };
    });
    setPosts(uiPosts);
    const { data: evRows, error: evErr } = await supabase
      .from("member_events")
      .select("*")
      .in("member_id", memberIds)
      .order("created_at", { ascending: false });
    if (evErr) {
      setLoadError(evErr.message);
      setLoading(false);
      return;
    }
    const evMap: Record<string, any[]> = {};
    for (const m of memberIds) evMap[m] = [];
    for (const row of evRows || []) {
      const iso = row.date ? String(row.date).slice(0, 10) : null;
      const rec = normalizeRecurrence(row.recurrence);
      const ui = {
        id: row.id,
        title: row.title,
        date: formatEventDateLabel(iso),
        time: formatDbTime(row.time),
        icon: row.icon || "📅",
        urgent: !!row.urgent,
        addedBy: row.added_by || undefined,
        isoDate: iso,
        recurrence: rec,
      };
      if (!evMap[row.member_id]) evMap[row.member_id] = [];
      evMap[row.member_id].push(ui);
    }
    setMemberEvents(evMap);
    const { data: stRows, error: stErr } = await supabase
      .from("stories")
      .select("*")
      .in("member_id", memberIds)
      .order("created_at", { ascending: true });
    if (stErr) {
      setLoadError(stErr.message);
      setLoading(false);
      return;
    }
    const stMap: Record<string, any[]> = {};
    for (const m of memberIds) stMap[m] = [];
    for (const row of stRows || []) {
      const seenRaw = row.seen_by;
      const seen = Array.isArray(seenRaw) ? seenRaw.map(String) : [];
      const t = new Date(row.created_at).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const ui = {
        id: row.id,
        memberId: row.member_id,
        type: row.type,
        text: row.text || "",
        bg: row.bg || STORY_BG_OPTIONS[0],
        photo: row.photo_url || null,
        time: t,
        seen,
      };
      if (!stMap[row.member_id]) stMap[row.member_id] = [];
      stMap[row.member_id].push(ui);
    }
    setStories(stMap);
    const { data: shopRows, error: shopErr } = await supabase
      .from("shop_items")
      .select("*")
      .eq("family_id", fam.id)
      .order("created_at", { ascending: false });
    if (shopErr) {
      setLoadError(shopErr.message);
      setLoading(false);
      return;
    }
    setShopItems(
      (shopRows || []).map((row: any) => ({
        id: row.id,
        text: row.text,
        qty: row.qty || "",
        done: row.done,
        memberId: row.member_id,
        cat: row.cat || "🛒",
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFamilyData();
  }, [loadFamilyData]);

  useEffect(() => {
    if (loading || loadError || !familyId || !currentMember) return;
    if (pushSetupDoneRef.current) return;
    pushSetupDoneRef.current = true;
    const memberId = currentMember;
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return;
      const perm = await Notification.requestPermission();
      if (cancelled || perm !== "granted") return;
      try {
        await subscribeToPush(memberId);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, loadError, familyId, currentMember]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hh = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const ss = String(now.getSeconds()).padStart(2, "0");
  const dd = now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  const gm = (id: string) => members.find((m) => m.id === id);
  const am = gm(currentMember);

  const toggleRead = async (postId: string) => {
    if (!currentMember) return;
    const has = posts.find((p) => p.id === postId)?.reads?.includes(currentMember);
    if (has) {
      const { error } = await supabase
        .from("post_reads")
        .delete()
        .eq("post_id", postId)
        .eq("member_id", currentMember);
      if (error) return;
      setPosts((p) =>
        p.map((x) =>
          x.id === postId
            ? { ...x, reads: x.reads.filter((v: string) => v !== currentMember) }
            : x
        )
      );
    } else {
      const { error } = await supabase.from("post_reads").insert({ post_id: postId, member_id: currentMember });
      if (error) return;
      setPosts((p) =>
        p.map((x) =>
          x.id === postId ? { ...x, reads: [...x.reads, currentMember] } : x
        )
      );
    }
  };

  const addComment = async (postId: string) => {
    if (!comment.trim() || !currentMember) return;
    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: postId, member_id: currentMember, text: comment.trim() })
      .select("id, member_id, text, created_at")
      .single();
    if (error || !data) return;
    const time = new Date(data.created_at).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    setPosts((p) =>
      p.map((x) =>
        x.id === postId
          ? {
              ...x,
              comments: [...x.comments, { memberId: data.member_id, text: data.text, time }],
            }
          : x
      )
    );
    setComment("");
  };

  const deletePost = async (postId: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) return;
    setPosts((p) => p.filter((x) => x.id !== postId));
    setExpanded((ex) => (ex === postId ? null : ex));
  };

  const submitPost = async () => {
    if (!newPost.content.trim() || !newPost.memberId) return;
    const { data, error } = await supabase
      .from("posts")
      .insert({
        member_id: newPost.memberId,
        type: newPost.type,
        content: newPost.content.trim(),
        pinned: false,
      })
      .select("id, member_id, type, content, pinned, date, time, created_at, event_date, event_time")
      .single();
    if (error || !data) return;
    const header = postHeaderFromCreated(data.created_at);
    setPosts((p) => [
      {
        id: data.id,
        memberId: data.member_id,
        type: data.type,
        pinned: data.pinned,
        date: header.date,
        time: header.time,
        reads: [],
        comments: [],
        content: data.content || "",
        eventDate: undefined,
        eventTime: undefined,
      },
      ...p,
    ]);
    setNewPost({ content: "", type: "status", memberId: currentMember });
    setCompose(false);

    if (familyId) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        const author = members.find((m) => m.id === data.member_id);
        const preview = (data.content || "").trim().slice(0, 100);
        const pushBody = preview.length > 0 ? preview + (preview.length >= 100 ? "…" : "") : "Neuer Post in DoFam";
        fetch("/api/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            familyId,
            title: "DoFam",
            body: `${author?.name ?? "Familie"}: ${pushBody}`,
            url: "/",
          }),
        }).catch(() => {});
      }
    }
  };

  const uploadPhoto = async (memberId: string, file: File) => {
    const r = new FileReader();
    r.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const { error } = await supabase.from("members").update({ photo_url: dataUrl }).eq("id", memberId);
      if (error) return;
      setMembers((p) => p.map((m) => (m.id === memberId ? { ...m, photo: dataUrl } : m)));
      setEditPhoto(null);
    };
    r.readAsDataURL(file);
  };

  const submitEvent = async (memberId?: string) => {
    const targetId = memberId || newEvent.forMemberId;
    if (!newEvent.title.trim() || !targetId || !currentMember) return;
    const d = newEvent.date?.trim() ?? "";
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : parseEventDate(d);
    if (!iso) return;
    const timeVal = newEvent.time?.trim() || null;
    const rec = normalizeRecurrence(newEvent.recurrence);
    const { data, error } = await supabase
      .from("member_events")
      .insert({
        member_id: targetId,
        title: newEvent.title.trim(),
        date: iso,
        time: timeVal,
        icon: newEvent.icon || "📅",
        urgent: false,
        added_by: currentMember,
        recurrence: rec,
      })
      .select("*")
      .single();
    if (error || !data) return;
    const row = data;
    const rowIso = row.date ? String(row.date).slice(0, 10) : null;
    const ui = {
      id: row.id,
      title: row.title,
      date: formatEventDateLabel(rowIso),
      time: formatDbTime(row.time),
      icon: row.icon || "📅",
      urgent: !!row.urgent,
      addedBy: row.added_by || undefined,
      isoDate: rowIso,
      recurrence: normalizeRecurrence(row.recurrence),
    };
    setMemberEvents((p) => ({
      ...p,
      [targetId]: [ui, ...(p[targetId] || [])],
    }));
    setNewEvent({ title: "", date: "", time: "", icon: "📅", forMemberId: currentMember, recurrence: "none" });
    setAddEventModal(false);
  };

  const removeEvent = async (memberId: string, eventId: string) => {
    const { error } = await supabase.from("member_events").delete().eq("id", eventId);
    if (error) return;
    setMemberEvents((p) => ({
      ...p,
      [memberId]: (p[memberId] || []).filter((e: any) => e.id !== eventId),
    }));
  };

  const allStoriesOf = (memberId: string) => stories[memberId] || [];
  const hasUnseen = (memberId: string) =>
    allStoriesOf(memberId).some((s: any) => !s.seen.includes(currentMember));

  const markSeen = async (memberId: string, storyId: string) => {
    const list = allStoriesOf(memberId);
    const s = list.find((x: any) => x.id === storyId);
    if (!s || s.seen.includes(currentMember)) return;
    const nextSeen = [...s.seen, currentMember];
    const { error } = await supabase.from("stories").update({ seen_by: nextSeen }).eq("id", storyId);
    if (error) return;
    setStories((p) => ({
      ...p,
      [memberId]: (p[memberId] || []).map((st: any) =>
        st.id === storyId ? { ...st, seen: nextSeen } : st
      ),
    }));
  };

  const submitStory = async () => {
    if (newStory.type === "text" && !newStory.text.trim()) return;
    if (newStory.type === "photo" && !newStory.photo) return;
    if (!currentMember) return;
    const { data, error } = await supabase
      .from("stories")
      .insert({
        member_id: currentMember,
        type: newStory.type,
        text: newStory.type === "text" ? newStory.text.trim() : null,
        bg: newStory.bg,
        photo_url: newStory.type === "photo" ? newStory.photo : null,
        seen_by: [],
      })
      .select("*")
      .single();
    if (error || !data) return;
    const t = new Date(data.created_at).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const ui = {
      id: data.id,
      memberId: data.member_id,
      type: data.type,
      text: data.text || "",
      bg: data.bg || STORY_BG_OPTIONS[0],
      photo: data.photo_url || null,
      time: t,
      seen: [] as string[],
    };
    setStories((p) => ({ ...p, [currentMember]: [...(p[currentMember] || []), ui] }));
    setNewStory({ type: "text", text: "", bg: STORY_BG_OPTIONS[0], photo: null });
    setAddStory(false);
  };

  const deleteStory = async (memberId: string, storyId: string) => {
    const { error } = await supabase.from("stories").delete().eq("id", storyId);
    if (error) return;
    setStories((p) => ({
      ...p,
      [memberId]: (p[memberId] || []).filter((s: any) => s.id !== storyId),
    }));
  };

  const openStory = (memberId: string) => {
    const list = allStoriesOf(memberId);
    if (!list.length) return;
    const firstUnseen = list.findIndex((s: any) => !s.seen.includes(currentMember));
    const idx = firstUnseen >= 0 ? firstUnseen : 0;
    setViewStory({ memberId, index: idx });
    markSeen(memberId, list[idx].id);
  };

  const nextStory = () => {
    if (!viewStory) return;
    const list = allStoriesOf(viewStory.memberId);
    if (viewStory.index < list.length - 1) {
      const ni = viewStory.index + 1;
      setViewStory({ ...viewStory, index: ni });
      markSeen(viewStory.memberId, list[ni].id);
    } else {
      const mIdx = members.findIndex((m) => m.id === viewStory.memberId);
      for (let i = mIdx + 1; i < members.length; i++) {
        if (allStoriesOf(members[i].id).length) {
          openStory(members[i].id);
          return;
        }
      }
      setViewStory(null);
    }
  };

  const prevStory = () => {
    if (!viewStory) return;
    if (viewStory.index > 0) {
      const ni = viewStory.index - 1;
      setViewStory({ ...viewStory, index: ni });
      markSeen(viewStory.memberId, allStoriesOf(viewStory.memberId)[ni].id);
    } else setViewStory(null);
  };

  async function openMemberInviteModal() {
    setMemberInviteModal(true);
    setMemberInviteLink("");
    setMemberInviteError(null);
    setMemberInviteCopied(false);
    setMemberInviteLoading(true);
    if (!familyId) {
      setMemberInviteLoading(false);
      setMemberInviteError("Keine Familie gefunden.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMemberInviteLoading(false);
      setMemberInviteError("Bitte melde dich erneut an.");
      return;
    }
    const token = randomInviteToken();
    const email = `link+${token.slice(0, 32)}@invite.dofam`;
    const { error: insErr } = await supabase.from("invitations").insert({
      family_id: familyId,
      email,
      token,
      invited_by: user.id,
    });
    if (insErr) {
      setMemberInviteLoading(false);
      setMemberInviteError(insErr.message);
      return;
    }
    setMemberInviteLink(`${MEMBER_INVITE_APP_BASE}/join?token=${encodeURIComponent(token)}`);
    setMemberInviteLoading(false);
  }

  async function copyMemberInviteLink() {
    if (!memberInviteLink) return;
    try {
      await navigator.clipboard.writeText(memberInviteLink);
      setMemberInviteCopied(true);
      setTimeout(() => setMemberInviteCopied(false), 2000);
    } catch {
      setMemberInviteError("Link konnte nicht kopiert werden.");
    }
  }

  function closeMemberInviteModal() {
    setMemberInviteModal(false);
    setMemberInviteLink("");
    setMemberInviteError(null);
    setMemberInviteCopied(false);
    setMemberInviteLoading(false);
  }

  if (loading) {
    return (
      <div
        style={{
          fontFamily: "'DM Sans',sans-serif",
          background: T.bg0,
          minHeight: "100vh",
          maxWidth: 430,
          margin: "0 auto",
          color: T.txt0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            border: `3px solid ${T.line}`,
            borderTopColor: T.red,
            borderRadius: "50%",
            animation: "famspin 0.75s linear infinite",
          }}
        />
        <div style={{ fontSize: 15, color: T.txt1, fontWeight: 600 }}>DoFam lädt…</div>
        <style>{`@keyframes famspin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        style={{
          fontFamily: "'DM Sans',sans-serif",
          background: T.bg0,
          minHeight: "100vh",
          maxWidth: 430,
          margin: "0 auto",
          color: T.txt0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>🏡</div>
        <p style={{ fontSize: 14, color: T.red, fontWeight: 600 }}>{loadError}</p>
        <p style={{ fontSize: 12, color: T.txt2 }}>
          Tabelle «post_reads» oder «families» fehlt? Migration in Supabase ausführen.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 430,
        margin: "0 auto",
        fontFamily: "'DM Sans',sans-serif",
        background: T.bg0,
        minHeight: "100vh",
        color: T.txt0,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:0}
        button{cursor:pointer;border:none;background:none;color:inherit;font-family:inherit}
        input,textarea{outline:none;font-family:inherit;color:inherit}
        textarea{resize:none}
        .in{animation:in .22s cubic-bezier(.4,0,.2,1)}
        @keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .slide{animation:slide .3s cubic-bezier(.4,0,.2,1)}
        @keyframes slide{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .dim{animation:dim .18s ease}
        @keyframes dim{from{opacity:0}to{opacity:1}}
        .r{transition:all .13s}.r:active{opacity:.65;transform:scale(.96)}
        .ev-row:hover{background:${T.bg3}!important}
        @keyframes storyProg{from{width:0%}to{width:100%}}
        .story-prog{animation:storyProg 5s linear forwards}
        @keyframes storyFade{from{opacity:0;transform:scale(1.04)}to{opacity:1;transform:scale(1)}}
        .story-fade{animation:storyFade .3s ease}
      `}</style>

      {/* HEADER */}
      <header style={{background:T.bg1,borderBottom:`1px solid ${T.line}`,position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 18px 10px"}}>
          <div>
            <div style={{fontSize:17,fontWeight:700,letterSpacing:-0.4,display:"flex",gap:0}}>
              <span style={{color:T.txt0}}>Do</span><span style={{color:T.amber}}>.</span><span style={{color:T.red}}>Fam</span>
            </div>
            <div style={{fontSize:10,color:T.txt2,marginTop:1,fontFamily:"monospace",letterSpacing:0.3}}>{dd}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button
              type="button"
              className="r"
              onClick={()=>setCompose(true)}
              aria-label="Neuer Post"
              style={{
                width:36,
                height:36,
                borderRadius:"50%",
                background:"#C8522A",
                color:"#fff",
                fontSize:22,
                fontWeight:500,
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                flexShrink:0,
                lineHeight:1,
                padding:0,
              }}
            >
              +
            </button>
            <button
              type="button"
              className="r"
              onClick={() => window.location.reload()}
              aria-label="Aktualisieren"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: T.bg3,
                border: `1px solid ${T.line}`,
                fontSize: 20,
                color: T.txt1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ↻
            </button>
            <button
              type="button"
              className="r"
              onClick={async () => {
                const {
                  data: { user },
                } = await supabase.auth.getUser();
                if (user?.email) setUserEmail(user.email);
                setSettingsNotifFeedback(null);
                setSettingsModal(true);
              }}
              aria-label="Einstellungen"
              style={{
                width:32,
                height:32,
                borderRadius:8,
                background:T.bg0,
                border:`1px solid ${T.line2}`,
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                fontSize:16,
                flexShrink:0,
              }}
            >
              ⚙️
            </button>
            <div style={{position:"relative"}}>
              <Av m={am} s={32}/>
              <div style={{position:"absolute",bottom:0,right:0,width:8,height:8,borderRadius:"50%",background:T.green,border:`2px solid ${T.bg1}`}}/>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{display:"flex",borderTop:`1px solid ${T.line}`}}>
          {[["dashboard","Dashboard","▦"],["feed","Feed","≡"],["cal","Kalender","◻"],["shop","Einkauf","🛒"],["members","Familie","◈"]].map(([id,label,ico])=>{
            const badge = id==="shop" ? shopItems.filter((i:any)=>!i.done).length : 0;
  return (
              <button key={id} className="r" onClick={()=>setTab(id)} style={{flex:1,padding:"10px 2px",fontSize:10,fontWeight:tab===id?600:400,color:tab===id?T.txt0:T.txt2,borderBottom:`2px solid ${tab===id?T.red:"transparent"}`,display:"flex",flexDirection:"column",alignItems:"center",gap:2,transition:"all .15s",position:"relative"}}>
                <span style={{fontSize:12,color:tab===id?T.red:T.txt2}}>{ico}</span>
                {label}
                {badge>0&&<span style={{position:"absolute",top:6,right:"10%",minWidth:15,height:15,borderRadius:8,background:T.red,color:"#fff",fontSize:8,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{badge}</span>}
              </button>
            );
          })}
        </div>

        {/* STORY BAR */}
        <div style={{display:"flex",gap:14,padding:"10px 16px 12px",overflowX:"auto",borderTop:`1px solid ${T.line}`}}>
          <button className="r" onClick={()=>setAddStory(true)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:52,flexShrink:0,background:"none",border:"none"}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:T.bg3,border:`2px dashed ${T.line2}`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
              <Av m={am} s={44}/>
              <div style={{position:"absolute",bottom:-1,right:-1,width:18,height:18,borderRadius:"50%",background:T.red,color:"#fff",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${T.bg1}`,fontWeight:700}}>+</div>
            </div>
            <span style={{fontSize:10,color:T.txt1,fontWeight:500}}>Meine</span>
          </button>
          {members.map(m=>{
            const list=allStoriesOf(m.id);
            if(!list.length) return null;
            const unseen=hasUnseen(m.id);
            return (
              <button key={m.id} className="r" onClick={()=>openStory(m.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:52,flexShrink:0,background:"none",border:"none"}}>
                <div style={{width:52,height:52,borderRadius:"50%",padding:2,background:unseen?`conic-gradient(${m.color} 0%,${T.amber} 100%)`:T.line2}}>
                  <div style={{width:"100%",height:"100%",borderRadius:"50%",padding:2,background:T.bg1}}>
                    <Av m={m} s={44}/>
                  </div>
                </div>
                <span style={{fontSize:10,color:unseen?m.color:T.txt2,fontWeight:unseen?700:400}}>{m.name}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* DASHBOARD */}
      {tab==="dashboard"&&(
        <div style={{ width: "100%", padding: "12px 12px 0" }}>
          <div style={{background:`linear-gradient(135deg,#FFF8F0,#FFF2E5)`,border:`1px solid ${T.line}`,borderRadius:14,padding:"16px 18px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",overflow:"hidden",position:"relative"}}>
            <div style={{position:"absolute",top:-30,right:-30,width:110,height:110,borderRadius:"50%",background:T.red,opacity:0.08}}/>
            <div style={{position:"absolute",bottom:-20,left:-20,width:70,height:70,borderRadius:"50%",background:T.amber,opacity:0.07}}/>
            <div>
              <div style={{fontFamily:"monospace",fontSize:36,fontWeight:500,letterSpacing:-1,color:T.txt0,lineHeight:1}}>
                {hh}<span style={{fontSize:20,color:T.txt2}}>:{ss}</span>
              </div>
              <div style={{fontSize:10,color:T.txt2,marginTop:4,textTransform:"uppercase",letterSpacing:1,fontFamily:"monospace"}}>{dd}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
              <button className="r" onClick={()=>{setNewEvent({title:"",date:"",time:"",icon:"📅",forMemberId:members[0]?.id??currentMember,recurrence:"none"});setAddEventModal(true);}} style={{background:T.red,borderRadius:8,padding:"7px 13px",color:"#fff",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:14}}>+</span> Termin
              </button>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:T.txt2,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8}}>Heute offen</div>
                <div style={{fontSize:20,fontWeight:700,color:T.txt0}}>{Object.values(memberEvents).flat().filter((e:any)=>e.isoDate && eventOccursOn(TODAY_ISO, e.isoDate, normalizeRecurrence(e.recurrence))).length}</div>
              </div>
            </div>
          </div>

          {/* PERSON CARDS */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            {members.map(m=>{
              const upcoming=expandMemberUpcomingOccurrences(memberEvents[m.id]||[],TODAY_ISO);
              const evs=upcoming.slice(0,3);
              const todayCount=(memberEvents[m.id]||[]).filter((e:any)=>e.isoDate&&eventOccursOn(TODAY_ISO,e.isoDate,normalizeRecurrence(e.recurrence))).length;
              return (
                <div key={m.id} className="in" style={{background:m.color+"0D",border:`1.5px solid ${m.color}33`,borderRadius:14,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                  <div style={{padding:"11px 12px 9px",background:m.color+"22",borderBottom:`1px solid ${m.color}33`,display:"flex",alignItems:"center",gap:8}}>
                    <Av m={m} s={30}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.txt0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.name}</div>
                      {todayCount>0
                        ?<div style={{fontSize:9,color:m.color,fontWeight:700,marginTop:1,textTransform:"uppercase",letterSpacing:0.5}}>{todayCount} heute</div>
                        :<div style={{fontSize:9,color:T.txt2,marginTop:1}}>Keine heute</div>}
                    </div>
                    <button className="r" onClick={()=>{setNewEvent({title:"",date:"",time:"",icon:"📅",forMemberId:m.id,recurrence:"none"});setAddEventModal(true);}} style={{width:22,height:22,borderRadius:6,background:m.color+"22",border:`1px solid ${m.color}55`,color:m.color,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>+</button>
                  </div>
                  <div style={{flex:1,padding:"6px 0"}}>
                    {evs.length===0&&<div style={{padding:"12px",textAlign:"center",fontSize:11,color:T.txt2}}>Keine Termine</div>}
                    {evs.map((ev:any,i:number)=>{
                      const addedBy=ev.addedBy?gm(ev.addedBy):null;
                      return (
                        <div key={`${ev.id}-${ev.occurrenceIso}`} className="ev-row" style={{display:"flex",alignItems:"center",gap:7,padding:"7px 12px",borderBottom:i<evs.length-1?`1px solid ${m.color}18`:"none"}}>
                          <div style={{width:28,height:28,borderRadius:7,background:ev.urgent?m.color+"33":"rgba(0,0,0,0.05)",border:`1px solid ${ev.urgent?m.color+"66":m.color+"22"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{ev.icon}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:ev.urgent?600:400,color:ev.urgent?T.txt0:T.txt1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.title}</div>
                            <div style={{fontSize:9,color:ev.urgent?m.color:T.txt2,marginTop:1,fontFamily:"monospace",display:"flex",gap:4}}>
                              <span>{ev.date} · {ev.time}</span>
                              {addedBy&&(addedBy as any).id!==m.id&&<span style={{opacity:0.7}}>· von {(addedBy as any).avatar}</span>}
                            </div>
                          </div>
                          <button className="r" onClick={()=>removeEvent(m.id,ev.id)} style={{fontSize:11,color:m.color+"88",padding:"2px 4px",borderRadius:4}}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                  {upcoming.length>3&&<div style={{padding:"6px 12px",borderTop:`1px solid ${m.color}22`,textAlign:"center",background:m.color+"0A"}}><span style={{fontSize:10,color:m.color,fontWeight:600}}>+{upcoming.length-3} weitere</span></div>}
                </div>
              );
            })}
          </div>

          {/* LATEST POSTS */}
          <div style={{marginBottom:0}}>
            <div style={{fontSize:10,fontWeight:700,color:T.txt2,textTransform:"uppercase",letterSpacing:1.2,marginBottom:8}}>Letzte Posts</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {posts.slice(0,3).map((post:any)=>{
                const mem=gm(post.memberId);
                return (
                  <div key={post.id} style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:12,padding:"10px 13px",display:"flex",gap:10,alignItems:"flex-start"}}>
                    <Av m={mem} s={34}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                        <span style={{fontSize:12,fontWeight:600,color:T.txt0}}>{mem?.name}</span>
                        <Chip type={post.type}/>
                        {post.pinned&&<span style={{fontSize:9,color:T.red,fontWeight:700}}>▲ PIN</span>}
                      </div>
                      <div style={{fontSize:12,color:T.txt1,lineHeight:1.4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{post.content}</div>
                      <div style={{fontSize:9,color:T.txt2,marginTop:4,fontFamily:"monospace"}}>{post.time} · {post.reads.length} gelesen</div>
                    </div>
                  </div>
                );
              })}
              <button className="r" onClick={()=>setTab("feed")} style={{background:T.bg2,border:`1px solid ${T.line2}`,borderRadius:10,padding:"9px",color:T.txt2,fontSize:12,fontWeight:500,marginBottom:16}}>Alle Posts im Feed →</button>
            </div>
          </div>
        </div>
      )}

      {/* FEED */}
      {tab==="feed"&&(
        <div style={{ width: "100%", padding: "12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
            {members.map(m=>(
              <button key={m.id} className="r" onClick={()=>setCurrentMember(m.id)} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 11px",borderRadius:8,background:currentMember===m.id?m.color+"18":T.bg2,border:`1px solid ${currentMember===m.id?m.color+"44":T.line}`,whiteSpace:"nowrap"}}>
                <Av m={m} s={22}/><span style={{fontSize:12,fontWeight:currentMember===m.id?600:400,color:currentMember===m.id?m.color:T.txt1}}>{m.name}</span>
              </button>
            ))}
          </div>
          {[...posts.filter((p:any)=>p.pinned),...posts.filter((p:any)=>!p.pinned)].map((post:any)=>(
            <PostCard key={post.id} post={post} gm={gm} active={currentMember}
              expanded={expanded===post.id}
              onExpand={()=>setExpanded(expanded===post.id?null:post.id)}
              onRead={()=>toggleRead(post.id)}
              comment={expanded===post.id?comment:""}
              onCommentChange={setComment}
              onComment={()=>addComment(post.id)}
              onDelete={post.memberId===currentMember ? () => void deletePost(post.id) : undefined}/>
          ))}
          <div style={{height:40}}/>
        </div>
      )}{/* KALENDER */}
      {tab==="cal"&&(()=>{
        const allEvs=Object.entries(memberEvents).flatMap(([mid,evs])=>
          (evs as any[]).map(ev=>({
            ...ev,
            memberId:mid,
            isoDate:(ev.isoDate ?? parseEventDate(ev.date)) || null,
            recurrence:normalizeRecurrence(ev.recurrence),
          }))
        ).filter((e):e is typeof e & { isoDate: string }=>!!e.isoDate);
        const eventsForDay=(iso:string)=>allEvs.filter(e=>eventOccursOn(iso,e.isoDate,e.recurrence));
        const y=calMonth.getFullYear(),mo=calMonth.getMonth();
        const firstDay=new Date(y,mo,1),lastDay=new Date(y,mo+1,0);
        const startOffset=(firstDay.getDay()+6)%7;
        const totalCells=Math.ceil((startOffset+lastDay.getDate())/7)*7;
        const cells=Array.from({length:totalCells},(_,i)=>{
          const d=i-startOffset+1;
          if(d<1||d>lastDay.getDate()) return null;
          const iso=`${y}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          return {d,iso,evs:eventsForDay(iso)};
        });
        const monthName=calMonth.toLocaleDateString("de-DE",{month:"long",year:"numeric"});
        const selEvs=eventsForDay(calSelected);
        const selLabel=new Date(calSelected).toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"});
        const DAY_LABELS=["Mo","Di","Mi","Do","Fr","Sa","So"];
        return (
          <div style={{ width: "100%", padding: "12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:14,padding:"12px 16px",width:"100%",boxSizing:"border-box"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <button className="r" onClick={()=>setCalMonth(new Date(y,mo-1,1))} style={{width:34,height:34,borderRadius:9,background:T.bg3,border:`1px solid ${T.line2}`,fontSize:16,color:T.txt1,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
                <div style={{fontWeight:700,fontSize:15,color:T.txt0}}>{monthName}</div>
                <button className="r" onClick={()=>setCalMonth(new Date(y,mo+1,1))} style={{width:34,height:34,borderRadius:9,background:T.bg3,border:`1px solid ${T.line2}`,fontSize:16,color:T.txt1,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:6}}>
                {DAY_LABELS.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:T.txt2,padding:"2px 0"}}>{d}</div>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
                {cells.map((cell,i)=>{
                  if(!cell) return <div key={i}/>;
                  const isToday=cell.iso===TODAY_ISO,isSel=cell.iso===calSelected;
                  const dotColors=[...new Set(cell.evs.map((e:any)=>members.find(m=>m.id===e.memberId)?.color))].filter(Boolean).slice(0,3) as string[];
                  return (
                    <button key={cell.iso} className="r" onClick={()=>setCalSelected(cell.iso)}
                      style={{aspectRatio:"1",borderRadius:9,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,background:isSel?T.red:isToday?T.redT:"transparent",border:`1.5px solid ${isSel?T.red:isToday?T.redB:"transparent"}`}}>
                      <span style={{fontSize:13,fontWeight:isSel||isToday?700:400,color:isSel?"#fff":isToday?T.red:T.txt0,lineHeight:1}}>{cell.d}</span>
                      {cell.evs.length>0&&<div style={{display:"flex",gap:2}}>{dotColors.map((c,di)=><div key={di} style={{width:4,height:4,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.8)":c}}/>)}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ width: "100%", minWidth: 0 }}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{ minWidth: 0 }}>
                  <div style={{fontSize:13,fontWeight:700,color:T.txt0}}>{selLabel}</div>
                  <div style={{fontSize:10,color:T.txt2,marginTop:1}}>{selEvs.length===0?"Keine Termine":`${selEvs.length} Termin${selEvs.length>1?"e":""}`}</div>
                </div>
                <button className="r" onClick={()=>{setNewEvent({title:"",date:calSelected,time:"",icon:"📅",forMemberId:members[0].id,recurrence:"none"});setAddEventModal(true);}} style={{background:T.red,borderRadius:8,padding:"7px 13px",color:"#fff",fontWeight:700,fontSize:12}}>+ Termin</button>
              </div>
              {selEvs.length===0
                ?<div style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:14,padding:"28px 16px",textAlign:"center"}}><div style={{fontSize:28,marginBottom:8}}>📅</div><div style={{fontSize:14,color:T.txt2}}>Kein Termin an diesem Tag</div></div>
                :<div style={{display:"flex",flexDirection:"column",gap:8}}>{selEvs.sort((a:any,b:any)=>a.time.localeCompare(b.time)).map((ev:any)=>{
                  const mem=members.find(m=>m.id===ev.memberId);
                  const addedBy=ev.addedBy?members.find(m=>m.id===ev.addedBy):null;
                  return (
                    <div key={`${ev.id}-${calSelected}`} className="in" style={{background:T.bg1,border:`1.5px solid ${mem?.color}33`,borderRadius:14,padding:"12px 14px",display:"flex",gap:12,alignItems:"center",borderLeft:`4px solid ${mem?.color}`}}>
                      <div style={{width:40,height:40,borderRadius:10,background:mem?.color+"18",border:`1px solid ${mem?.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{ev.icon}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:600,color:T.txt0}}>{ev.title}</div>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3,flexWrap:"wrap"}}>
                          <span style={{fontSize:11,fontFamily:"monospace",color:T.txt2}}>{ev.time} Uhr</span>
                          <Av m={mem} s={16}/>
                          <span style={{fontSize:11,color:mem?.color,fontWeight:600}}>{mem?.name}</span>
                          {addedBy&&(addedBy as any).id!==mem?.id&&<span style={{fontSize:10,color:T.txt2}}>· von {(addedBy as any).name}</span>}
                        </div>
                      </div>
                      <button className="r" onClick={()=>removeEvent(mem!.id,ev.id)} style={{fontSize:13,color:T.txt2,padding:"4px 6px",opacity:0.5}}>✕</button>
                    </div>
                  );
                })}</div>
              }
            </div>
            <div style={{height:24}}/>
          </div>
        );
      })()}

      {/* EINKAUFSLISTE */}
      {tab==="shop"&&(()=>{
        const open=shopItems.filter((i:any)=>!i.done),done=shopItems.filter((i:any)=>i.done);
        const shown=shopFilter==="open"?open:shopFilter==="done"?done:shopItems;
        const CAT_OPTS=["🛒","🥛","🍞","🥩","🐟","🧀","🥚","🍎","🥦","🍝","🧃","🧹","🧴","💊","🐾"];
        const addShopItem = async () => {
          console.log("addShopItem called", { familyId, currentMember, newItem });
          if (!newItem.text.trim() || !familyId || !currentMember) return;
          const { data: inserted, error } = await supabase
            .from("shop_items")
            .insert({
              family_id: familyId,
              text: newItem.text.trim(),
              qty: newItem.qty.trim() || null,
              cat: newItem.cat || "🛒",
              done: false,
              member_id: currentMember,
            })
            .select("id, text, qty, done, member_id, cat")
            .maybeSingle();
          if (error) {
            console.error("Shop item error:", error);
            return;
          }
          if (!inserted) return;
          setShopItems((p) => [
            ...p,
            {
              id: inserted.id,
              text: inserted.text,
              qty: inserted.qty ?? "",
              done: inserted.done,
              memberId: inserted.member_id,
              cat: inserted.cat || "🛒",
            },
          ]);
          setNewItem({ text: "", qty: "", cat: "🛒" });
        };
        const toggleDone=async(id:string)=>{
          const item=shopItems.find((x:any)=>x.id===id);
          if(!item)return;
          const { error } = await supabase.from("shop_items").update({ done: !item.done }).eq("id", id);
          if (error) return;
          setShopItems(p=>p.map((x:any)=>x.id===id?{...x,done:!x.done}:x));
        };
        const removeItem=async(id:string)=>{
          const { error } = await supabase.from("shop_items").delete().eq("id", id);
          if (error) return;
          setShopItems(p=>p.filter((x:any)=>x.id!==id));
        };
        return (
          <div style={{ width: "100%", padding: "12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:14,padding:"14px 16px",display:"flex"}}>
              {[["Offen",open.length,T.red],["Erledigt",done.length,T.green],["Gesamt",shopItems.length,T.txt0]].map(([l,v,c],i,arr)=>(
                <div key={String(l)} style={{flex:1,textAlign:"center",borderRight:i<arr.length-1?`1px solid ${T.line}`:"none"}}>
                  <div style={{fontSize:26,fontWeight:800,color:String(c)}}>{v}</div>
                  <div style={{fontSize:10,color:T.txt2,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8,marginTop:2}}>{String(l)}</div>
                </div>
              ))}
            </div>
            <div style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:14,padding:"12px 14px"}}>
              <div style={{fontSize:10,fontWeight:700,color:T.txt2,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Artikel hinzufügen</div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <select value={newItem.cat} onChange={e=>setNewItem(p=>({...p,cat:e.target.value}))} style={{width:42,height:40,borderRadius:8,background:T.bg3,border:`1px solid ${T.line2}`,fontSize:18,textAlign:"center",color:T.txt0,cursor:"pointer"}}>
                  {CAT_OPTS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <input value={newItem.text} onChange={e=>setNewItem(p=>({...p,text:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addShopItem()} placeholder="Was wird gebraucht?" style={{flex:1,background:T.bg3,border:`1px solid ${T.line2}`,borderRadius:8,padding:"0 11px",fontSize:14,color:T.txt0,height:40}}/>
                <input value={newItem.qty} onChange={e=>setNewItem(p=>({...p,qty:e.target.value}))} placeholder="Menge" style={{width:68,background:T.bg3,border:`1px solid ${T.line2}`,borderRadius:8,padding:"0 8px",fontSize:13,color:T.txt0,height:40}}/>
              </div>
              <button className="r" onClick={addShopItem} style={{width:"100%",background:T.red,borderRadius:9,padding:"10px",color:"#fff",fontWeight:700,fontSize:14}}>+ Zur Liste hinzufügen</button>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {[["all","Alle"],["open","Offen"],["done","Erledigt"]].map(([k,v])=>(
                <button key={k} className="r" onClick={()=>setShopFilter(k)} style={{padding:"6px 12px",borderRadius:20,background:shopFilter===k?T.txt0:T.bg3,color:shopFilter===k?T.bg1:T.txt1,fontWeight:shopFilter===k?700:400,fontSize:12,border:`1px solid ${shopFilter===k?T.txt0:T.line}`}}>{v}</button>
              ))}
              {done.length>0&&<button className="r" onClick={async()=>{
                  const ids=done.map((x:any)=>x.id);
                  const { error } = await supabase.from("shop_items").delete().in("id", ids);
                  if (error) return;
                  setShopItems(p=>p.filter((x:any)=>!x.done));
                }} style={{marginLeft:"auto",padding:"6px 12px",borderRadius:20,background:T.redT,color:T.red,fontWeight:600,fontSize:12,border:`1px solid ${T.redB}`}}>Erledigte löschen</button>}
            </div>
            <div style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:14,overflow:"hidden"}}>
              {shown.length===0&&<div style={{padding:"30px",textAlign:"center",color:T.txt2,fontSize:14}}>{shopFilter==="done"?"Noch nichts erledigt 🛒":"Liste ist leer! 🎉"}</div>}
              {shown.map((item:any,i:number)=>{
                const addedBy=gm(item.memberId);
                return (
                  <div key={item.id} className="in" style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderBottom:i<shown.length-1?`1px solid ${T.line}`:"none",background:item.done?"rgba(61,140,110,0.04)":"transparent"}}>
                    <button className="r" onClick={()=>toggleDone(item.id)} style={{width:26,height:26,borderRadius:"50%",border:`2px solid ${item.done?T.green:T.line2}`,background:item.done?T.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {item.done&&<span style={{fontSize:13,color:"#fff"}}>✓</span>}
                    </button>
                    <span style={{fontSize:20,flexShrink:0}}>{item.cat}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:item.done?400:600,color:item.done?T.txt2:T.txt0,textDecoration:item.done?"line-through":"none"}}>{item.text}</div>
                      <div style={{display:"flex",gap:6,marginTop:2}}>
                        {item.qty&&<span style={{fontSize:10,fontWeight:600,color:T.txt2,background:T.bg3,padding:"1px 6px",borderRadius:4}}>{item.qty}</span>}
                        <span style={{fontSize:10,color:T.txt2}}>von {addedBy?.avatar} {addedBy?.name}</span>
                      </div>
                    </div>
                    <button className="r" onClick={()=>removeItem(item.id)} style={{fontSize:14,color:T.txt2,padding:"4px 6px",opacity:0.5}}>✕</button>
                  </div>
                );
              })}
            </div>
            <div style={{background:`linear-gradient(135deg,${T.amber}18,${T.amber}08)`,border:`1px solid ${T.amberB}`,borderRadius:14,padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:24}}>🛍️</span>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:T.txt0}}>Im Laden?</div><div style={{fontSize:12,color:T.txt1,marginTop:1}}>Hake einfach ab was du einpackst.</div></div>
              <div style={{textAlign:"center"}}><div style={{fontSize:10,fontWeight:700,color:T.amber,textTransform:"uppercase"}}>Offen</div><div style={{fontSize:22,fontWeight:800,color:T.amber}}>{open.length}</div></div>
            </div>
            <div style={{height:24}}/>
          </div>
        );
      })()}

      {/* FAMILIE */}
      {tab==="members"&&(
        <div style={{ width: "100%", padding: "12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          {members.map(m=>{
            const myPosts=posts.filter((p:any)=>p.memberId===m.id);
            const reads=myPosts.reduce((s:number,p:any)=>s+p.reads.length,0);
            const isActive=currentMember===m.id;
            return (
              <div key={m.id} className="in" style={{background:T.bg1,border:`1px solid ${isActive?m.color+"44":T.line}`,borderRadius:14,overflow:"hidden"}}>
                <div style={{padding:"16px 16px 14px",display:"flex",gap:13,alignItems:"center"}}>
                  <div style={{position:"relative"}}>
                    <Av m={m} s={52}/>
                    <button className="r" onClick={()=>setEditPhoto(editPhoto===m.id?null:m.id)} style={{position:"absolute",bottom:-1,right:-1,width:19,height:19,borderRadius:"50%",background:T.bg3,border:`1.5px solid ${T.line2}`,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",color:T.txt1}}>✎</button>
                  </div>
                  <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:T.txt0}}>{m.name}</div><div style={{fontSize:11,color:T.txt2,marginTop:1}}>{m.role}</div></div>
                  <button className="r" onClick={()=>setCurrentMember(m.id)} style={{background:isActive?m.color:T.bg3,border:`1px solid ${isActive?m.color:T.line2}`,borderRadius:7,padding:"6px 13px",fontSize:11,fontWeight:600,color:isActive?"#fff":T.txt1}}>
                    {isActive?"✓ Aktiv":"Wählen"}
                  </button>
                </div>
                {editPhoto===m.id&&<PhotoPanel m={m} onUpload={f=>uploadPhoto(m.id,f)} onRemove={async()=>{const { error } = await supabase.from("members").update({ photo_url: null }).eq("id", m.id);if(error)return;setMembers(p=>p.map(x=>x.id===m.id?{...x,photo:null}:x));setEditPhoto(null);}} onClose={()=>setEditPhoto(null)}/>}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:T.line}}>
                  {[["Posts",myPosts.length],["Gelesen",reads],["Termine",(memberEvents[m.id]||[]).length]].map(([l,v])=>(
                    <div key={String(l)} style={{background:T.bg2,padding:"11px 6px",textAlign:"center"}}>
                      <div style={{fontSize:19,fontWeight:700,color:m.color,fontFamily:"monospace"}}>{v}</div>
                      <div style={{fontSize:9,color:T.txt2,marginTop:1,fontWeight:500,textTransform:"uppercase",letterSpacing:0.5}}>{String(l)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="r"
            onClick={openMemberInviteModal}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              background: T.amberT,
              border: `2px solid ${T.amberB}`,
              color: T.amber,
              fontWeight: 700,
              fontSize: 14,
              marginTop: 4,
            }}
          >
            👋 Mitglied einladen
          </button>
          <div style={{ height: 40 }} />
        </div>
      )}

      {/* EINSTELLUNGEN MODAL */}
      {settingsModal && (
        <div
          className="dim"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(44,31,20,0.55)",
            zIndex: 165,
            display: "flex",
            alignItems: "flex-end",
            maxWidth: 430,
            margin: "0 auto",
          }}
        >
          <div
            className="slide"
            style={{
              background: T.bg0,
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              borderTop: `3px solid ${T.red}`,
              boxShadow: "0 -8px 32px rgba(44,31,20,0.12)",
            }}
          >
            <div style={{ width: 32, height: 3, background: T.line2, borderRadius: 2, margin: "12px auto 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px 0" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.txt0 }}>
                <span style={{ color: T.txt0 }}>Do</span>
                <span style={{ color: T.amber }}>.</span>
                <span style={{ color: T.red }}>Fam</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.txt1, marginLeft: 8 }}>Einstellungen</span>
              </div>
              <button
                type="button"
                className="r"
                onClick={() => setSettingsModal(false)}
                style={{
                  background: T.bg1,
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  fontSize: 14,
                  color: T.txt1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid ${T.line}`,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "18px 18px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: T.bg1,
                  border: `1px solid ${T.line}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>
                  👤
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: T.txt2,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 4,
                    }}
                  >
                    Angemeldet als
                  </div>
                  <div style={{ fontSize: 14, color: T.txt0, wordBreak: "break-all", fontWeight: 600 }}>{userEmail || "—"}</div>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  className="r"
                  onClick={async () => {
                    setSettingsNotifFeedback(null);
                    if (
                      typeof window === "undefined" ||
                      !("Notification" in window) ||
                      !("serviceWorker" in navigator) ||
                      !("PushManager" in window)
                    ) {
                      return;
                    }
                    if (!currentMember) return;
                    const perm = await Notification.requestPermission();
                    if (perm !== "granted") return;
                    try {
                      await subscribeToPush(currentMember);
                      setSettingsNotifFeedback("✅ Aktiviert!");
                    } catch {
                      /* ignore */
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: 11,
                    background: T.bg1,
                    border: `1px solid ${T.line}`,
                    color: T.txt0,
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  🔔 Benachrichtigungen aktivieren
                </button>
                {settingsNotifFeedback ? (
                  <p style={{ marginTop: 10, fontSize: 13, color: T.green, fontWeight: 600 }} role="status">
                    {settingsNotifFeedback}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="r"
                onClick={() => {
                  setSettingsModal(false);
                  router.push("/invite");
                }}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: 11,
                  background: T.bg1,
                  border: `1px solid ${T.line}`,
                  color: T.txt0,
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                👋 Mitglied einladen
              </button>
              <button
                type="button"
                className="r"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setSettingsModal(false);
                  router.push("/login");
                }}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: 11,
                  background: T.red,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Abmelden
              </button>
              <button
                type="button"
                className="r"
                onClick={() => setSettingsModal(false)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 10,
                  background: T.bg2,
                  color: T.txt1,
                  fontWeight: 600,
                  fontSize: 13,
                  border: `1px solid ${T.line}`,
                }}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MITGLIED EINLADEN MODAL */}
      {memberInviteModal && (
        <div
          className="dim"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(44,31,20,0.6)",
            zIndex: 160,
            display: "flex",
            alignItems: "flex-end",
            maxWidth: 430,
            margin: "0 auto",
          }}
        >
          <div
            className="slide"
            style={{
              background: T.bg1,
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxHeight: "88vh",
              overflowY: "auto",
              borderTop: `2px solid ${T.red}`,
            }}
          >
            <div style={{ width: 32, height: 3, background: T.line2, borderRadius: 2, margin: "12px auto 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 0" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.txt0 }}>Mitglied einladen</div>
              <button
                type="button"
                className="r"
                onClick={closeMemberInviteModal}
                style={{
                  background: T.bg3,
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  fontSize: 13,
                  color: T.txt1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "16px 16px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
              {memberInviteLoading ? (
                <p style={{ fontSize: 14, color: T.txt1, textAlign: "center", padding: "12px 0" }}>Einladung wird erstellt…</p>
              ) : null}
              {!memberInviteLoading && memberInviteLink ? (
                <>
                  <p style={{ fontSize: 13, color: T.txt1, lineHeight: 1.5, textAlign: "center" }}>
                    Teile diesen Link mit deinem Familienmitglied
                  </p>
                  <div
                    style={{
                      fontSize: 11,
                      color: T.txt2,
                      fontFamily: "monospace",
                      wordBreak: "break-all",
                      background: T.bg2,
                      border: `1px solid ${T.line}`,
                      borderRadius: 10,
                      padding: "11px 12px",
                      lineHeight: 1.45,
                    }}
                  >
                    {memberInviteLink}
                  </div>
                  <button
                    type="button"
                    className="r"
                    onClick={copyMemberInviteLink}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: 11,
                      background: T.red,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {memberInviteCopied ? "Kopiert! ✓" : "Link kopieren 📋"}
                  </button>
                </>
              ) : null}
              {memberInviteError ? (
                <p style={{ fontSize: 13, color: T.red, textAlign: "center" }} role="alert">
                  {memberInviteError}
                </p>
              ) : null}
              {!memberInviteLoading && !memberInviteLink ? (
                <button
                  type="button"
                  className="r"
                  onClick={closeMemberInviteModal}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 10,
                    background: T.bg3,
                    color: T.txt1,
                    fontWeight: 600,
                    fontSize: 14,
                    border: `1px solid ${T.line}`,
                  }}
                >
                  Schließen
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* TERMIN MODAL */}
      {addEventModal&&(()=>{
        const forM=gm(newEvent.forMemberId);
        const ICON_OPTS=["📅","🦷","💼","🏥","🎹","⚽","🎉","🚌","🏫","🏃","🔧","✈️","🎂","🎓","💉","🐾"];
        return (
          <div className="dim" style={{position:"fixed",inset:0,background:"rgba(44,31,20,0.6)",zIndex:150,display:"flex",alignItems:"flex-end",maxWidth:430,margin:"0 auto"}}>
            <div className="slide" style={{background:T.bg1,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"90vh",overflowY:"auto",borderTop:`2px solid ${T.red}`}}>
              <div style={{width:32,height:3,background:T.line2,borderRadius:2,margin:"12px auto 0"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px 0"}}>
                <div style={{fontSize:16,fontWeight:700,color:T.txt0}}>Termin erfassen</div>
                <button className="r" onClick={()=>setAddEventModal(false)} style={{background:T.bg3,borderRadius:"50%",width:30,height:30,fontSize:13,color:T.txt1,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
              <div style={{padding:"16px 16px 28px",display:"flex",flexDirection:"column",gap:14}}>
                <div>
                  <SLabel>Für wen?</SLabel>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {members.map(m=>{
                      const on=newEvent.forMemberId===m.id;
                      return (
                        <button key={m.id} className="r" onClick={()=>setNewEvent(p=>({...p,forMemberId:m.id}))} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 12px",borderRadius:11,background:on?m.color+"18":T.bg3,border:`1.5px solid ${on?m.color:T.line}`}}>
                          <Av m={m} s={32}/>
                          <div style={{textAlign:"left"}}>
                            <div style={{fontSize:13,fontWeight:700,color:on?m.color:T.txt0}}>{m.name}</div>
                            <div style={{fontSize:10,color:T.txt2}}>{m.role}</div>
                          </div>
                          {on&&<span style={{marginLeft:"auto",fontSize:14,color:m.color}}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <SLabel>Kategorie</SLabel>
                  <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                    {ICON_OPTS.map(ico=>(
                      <button key={ico} className="r" onClick={()=>setNewEvent(p=>({...p,icon:ico}))} style={{width:36,height:36,borderRadius:9,background:newEvent.icon===ico?T.red+"18":T.bg3,border:`1.5px solid ${newEvent.icon===ico?T.red:T.line}`,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>{ico}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <SLabel>Terminname *</SLabel>
                  <input value={newEvent.title} onChange={e=>setNewEvent(p=>({...p,title:e.target.value}))} placeholder={`z.B. Zahnarzt ${forM?.name}`} style={{width:"100%",background:T.bg3,border:`1px solid ${T.line2}`,borderRadius:10,padding:"11px 13px",fontSize:14,color:T.txt0}}/>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <div style={{flex:1}}>
                    <SLabel>Datum</SLabel>
                    <input
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent((p) => ({ ...p, date: e.target.value }))}
                      style={{
                        width: "100%",
                        background: "#EAE2D6",
                        border: "1px solid #C9BFB0",
                        borderRadius: 10,
                        padding: "11px 13px",
                        fontSize: 13,
                        color: "#2C1F14",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                  <div style={{ width: 128, flexShrink: 0 }}>
                    <SLabel>Uhrzeit</SLabel>
                    <input
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent((p) => ({ ...p, time: e.target.value }))}
                      style={{
                        width: "100%",
                        background: "#EAE2D6",
                        border: "1px solid #C9BFB0",
                        borderRadius: 10,
                        padding: "11px 13px",
                        fontSize: 13,
                        color: "#2C1F14",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <SLabel>Wiederholung</SLabel>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    {RECURRENCE_OPTIONS.map((opt) => {
                      const on = newEvent.recurrence === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          className="r"
                          onClick={() => setNewEvent((p) => ({ ...p, recurrence: opt.id }))}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 999,
                            background: on ? T.amber + "24" : T.bg3,
                            border: `1.5px solid ${on ? T.amber : T.line}`,
                            color: on ? T.txt0 : T.txt1,
                            fontWeight: on ? 700 : 500,
                            fontSize: 12,
                            flexShrink: 0,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{background:T.bg2,borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:8}}>
                  <Av m={am} s={26}/>
                  <span style={{fontSize:12,color:T.txt1}}>Erfasst von <strong style={{color:T.txt0}}>{am?.name}</strong></span>
                </div>
                <button className="r" onClick={()=>submitEvent(newEvent.forMemberId)} style={{width:"100%",padding:"14px",borderRadius:11,background:T.red,color:"#fff",fontWeight:700,fontSize:15}}>
                  Termin speichern für {forM?.avatar} {forM?.name}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* COMPOSE */}
      {compose&&(
        <div className="dim" style={{position:"fixed",inset:0,background:"rgba(44,31,20,0.55)",zIndex:100,display:"flex",alignItems:"flex-end",maxWidth:430,margin:"0 auto"}}>
          <div className="slide" style={{background:T.bg1,borderRadius:"18px 18px 0 0",padding:22,width:"100%",maxHeight:"88vh",overflowY:"auto",borderTop:`2px solid ${T.red}`}}>
            <div style={{width:30,height:3,background:T.line3,borderRadius:2,margin:"0 auto 18px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{fontSize:16,fontWeight:700,color:T.txt0}}>Neuer Post</div>
              <button className="r" onClick={()=>setCompose(false)} style={{background:T.bg3,borderRadius:"50%",width:30,height:30,fontSize:13,color:T.txt1,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <SLabel>Als wer?</SLabel>
            <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
              {members.map(m=>{
                const on=newPost.memberId===m.id;
                return <button key={m.id} className="r" onClick={()=>setNewPost(p=>({...p,memberId:m.id}))} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 11px",borderRadius:7,background:on?m.color+"18":T.bg3,border:`1px solid ${on?m.color+"44":T.line}`,color:on?m.color:T.txt1,fontWeight:on?600:400,fontSize:12}}><Av m={m} s={18}/>{m.name}</button>;
              })}
            </div>
            <SLabel>Typ</SLabel>
            <div style={{display:"flex",gap:6,marginBottom:16}}>
              {Object.entries({status:"Status",event:"Termin",reminder:"Erinnerung"}).map(([k,v])=>{
                const on=newPost.type===k,tc=TYPE[k];
                return <button key={k} className="r" onClick={()=>setNewPost(p=>({...p,type:k}))} style={{flex:1,padding:"8px 4px",borderRadius:7,background:on?tc.bg:T.bg3,border:`1px solid ${on?tc.border:T.line}`,color:on?tc.color:T.txt2,fontWeight:on?600:400,fontSize:11}}>{v}</button>;
              })}
            </div>
            <textarea value={newPost.content} onChange={e=>setNewPost(p=>({...p,content:e.target.value}))} placeholder="Was möchtest du mitteilen?" style={{width:"100%",background:T.bg3,border:`1px solid ${T.line2}`,borderRadius:10,padding:"12px 13px",color:T.txt0,fontSize:14,minHeight:95,lineHeight:1.55}}/>
            <button className="r" onClick={submitPost} style={{width:"100%",marginTop:10,background:T.red,borderRadius:10,padding:13,color:"#fff",fontWeight:700,fontSize:14}}>Posten</button>
          </div>
        </div>
      )}

      {/* STORY VIEWER */}
      {viewStory&&(()=>{
        const m=gm(viewStory.memberId),list=allStoriesOf(viewStory.memberId),s=list[viewStory.index];
        if(!s||!m) return null;
        return (
          <div className="dim" style={{position:"fixed",inset:0,zIndex:200,background:"#000",display:"flex",flexDirection:"column",maxWidth:430,margin:"0 auto"}}>
            <div style={{display:"flex",gap:3,padding:"10px 12px 6px",flexShrink:0}}>
              {list.map((st:any,i:number)=>(
                <div key={st.id} style={{flex:1,height:2.5,borderRadius:2,background:"rgba(255,255,255,0.25)",overflow:"hidden"}}>
                  <div className={i===viewStory.index?"story-prog":""} style={{height:"100%",background:"#fff",width:i<viewStory.index?"100%":i>viewStory.index?"0%":undefined}}/>
                </div>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"4px 14px 10px",flexShrink:0}}>
              <Av m={m} s={36}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{m.name}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.55)"}}>Heute · {s.time}</div></div>
              {viewStory.memberId===currentMember&&<button className="r" onClick={()=>{deleteStory(viewStory.memberId,s.id);setViewStory(null);}} style={{color:"rgba(255,255,255,0.65)",fontSize:11,padding:"4px 10px",borderRadius:6,background:"rgba(255,255,255,0.12)",fontWeight:600}}>Löschen</button>}
              <button className="r" onClick={()=>setViewStory(null)} style={{color:"rgba(255,255,255,0.75)",fontSize:22,padding:"0 4px"}}>✕</button>
            </div>
            <div className="story-fade" key={s.id} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:s.photo?"#000":s.bg,cursor:"pointer",position:"relative"}}
              onClick={e=>{const x=e.clientX,w=(e.currentTarget as HTMLElement).offsetWidth;x<w/3?prevStory():nextStory();}}>
              {s.type==="photo"&&s.photo&&<img src={s.photo} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>}
              {s.text&&<div style={{padding:"24px 32px",textAlign:"center"}}><div style={{fontSize:26,fontWeight:700,color:"#fff",lineHeight:1.35,textShadow:"0 2px 14px rgba(0,0,0,0.35)"}}>{s.text}</div></div>}
            </div>
            <div style={{padding:"10px 16px 22px",flexShrink:0,background:"rgba(0,0,0,0.4)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>👁</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{s.seen.length} gesehen</span>
                <div style={{display:"flex",marginLeft:2}}>{s.seen.map((sid:string)=><div key={sid} style={{width:22,height:22,borderRadius:"50%",overflow:"hidden",marginLeft:-5,border:"2px solid #000"}}><Av m={gm(sid)} s={22}/></div>)}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ADD STORY */}
      {addStory&&(
        <div className="dim" style={{position:"fixed",inset:0,background:"rgba(44,31,20,0.6)",zIndex:150,display:"flex",alignItems:"flex-end",maxWidth:430,margin:"0 auto"}}>
          <div className="slide" style={{background:T.bg1,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"90vh",overflowY:"auto",borderTop:`2px solid ${T.red}`}}>
            <div style={{width:32,height:3,background:T.line2,borderRadius:2,margin:"12px auto 0"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px 0"}}>
              <div style={{fontSize:16,fontWeight:700,color:T.txt0}}>Story erstellen 🌟</div>
              <button className="r" onClick={()=>setAddStory(false)} style={{background:T.bg3,borderRadius:"50%",width:30,height:30,fontSize:13,color:T.txt1,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <div style={{margin:"14px 16px 0",borderRadius:14,overflow:"hidden",height:190,background:newStory.type==="photo"&&newStory.photo?"#111":newStory.bg,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",flexShrink:0}}>
              {newStory.photo?<img src={newStory.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                :<div style={{padding:20,textAlign:"center",color:"rgba(255,255,255,0.9)",fontSize:18,fontWeight:700,lineHeight:1.35}}>{newStory.text||<span style={{opacity:0.4}}>Vorschau…</span>}</div>}
              <div style={{position:"absolute",top:8,left:10,display:"flex",alignItems:"center",gap:6}}><Av m={am} s={26}/><span style={{fontSize:11,color:"rgba(255,255,255,0.85)",fontWeight:600}}>{am?.name}</span></div>
            </div>
            <div style={{padding:"14px 16px 24px",display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",gap:8}}>
                {[["text","✏️ Text"],["photo","📷 Foto"]].map(([k,v])=>(
                  <button key={k} className="r" onClick={()=>setNewStory(p=>({...p,type:k,photo:null,text:""}))} style={{flex:1,padding:"9px",borderRadius:10,background:newStory.type===k?T.red:T.bg3,color:newStory.type===k?"#fff":T.txt1,fontWeight:600,fontSize:13,border:`1px solid ${newStory.type===k?T.red:T.line}`}}>{v}</button>
                ))}
              </div>
              {newStory.type==="text"&&<textarea value={newStory.text} onChange={e=>setNewStory(p=>({...p,text:e.target.value}))} placeholder="Was möchtest du teilen?" maxLength={120} style={{background:T.bg3,border:`1px solid ${T.line2}`,borderRadius:10,padding:"11px 13px",color:T.txt0,fontSize:15,minHeight:70,lineHeight:1.5}}/>}
              {newStory.type==="photo"&&<StoryPhotoUpload photo={newStory.photo} onPhoto={photo=>setNewStory(p=>({...p,photo}))}/>}
              {newStory.type==="text"&&(
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:T.txt2,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Hintergrundfarbe</div>
                  <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                    {STORY_BG_OPTIONS.map(c=><button key={c} className="r" onClick={()=>setNewStory(p=>({...p,bg:c}))} style={{width:34,height:34,borderRadius:"50%",background:c,border:`3px solid ${newStory.bg===c?"#fff":c}`,outline:newStory.bg===c?`2.5px solid ${T.red}`:"none",outlineOffset:1}}/>)}
                  </div>
                </div>
              )}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button className="r" onClick={()=>setAddStory(false)} style={{flex:1,padding:"12px",borderRadius:10,background:T.bg3,color:T.txt1,fontWeight:600,fontSize:14,border:`1px solid ${T.line}`}}>Abbrechen</button>
                <button className="r" onClick={submitStory} style={{flex:2,padding:"12px",borderRadius:10,background:T.red,color:"#fff",fontWeight:700,fontSize:14}}>Story posten</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FamilyApp;
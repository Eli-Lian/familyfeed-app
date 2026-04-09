"use client";
import { useState, useEffect, useRef } from "react";

const T = {
  bg0:"#F5EFE6", bg1:"#FFFFFF", bg2:"#F0E9DF", bg3:"#EAE2D6", bg4:"#E2D8CA",
  line:"#DDD5C8", line2:"#C9BFB0", line3:"#B8AC9C",
  txt0:"#2C1F14", txt1:"#7A6555", txt2:"#A8937E",
  red:"#C8522A",   redT:"rgba(200,82,42,0.10)",   redB:"rgba(200,82,42,0.25)",
  blue:"#3A6DBF",  blueT:"rgba(58,109,191,0.10)",  blueB:"rgba(58,109,191,0.25)",
  green:"#3D8C6E", greenT:"rgba(61,140,110,0.10)", greenB:"rgba(61,140,110,0.25)",
  amber:"#C47B0A", amberT:"rgba(196,123,10,0.10)", amberB:"rgba(196,123,10,0.25)",
} as const;const INIT_MEMBERS = [
  { id:1, name:"Mama", avatar:"👩", photo:null as string|null, color:T.red,   role:"Elternteil" },
  { id:2, name:"Papa", avatar:"👨", photo:null as string|null, color:T.blue,  role:"Elternteil" },
  { id:3, name:"Lena", avatar:"👧", photo:null as string|null, color:T.green, role:"Kind" },
  { id:4, name:"Max",  avatar:"👦", photo:null as string|null, color:T.amber, role:"Kind" },
];

const TODAY_ISO = new Date().toISOString().slice(0,10);
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

const MEMBER_EVENTS: Record<number, any[]> = {
  1: [
    { id:"e1", title:"Zahnarzt",       date:"Mo, 07. Apr", time:"09:00", icon:"🦷", urgent:true  },
    { id:"e2", title:"Team Meeting",   date:"Di, 08. Apr", time:"10:30", icon:"💼", urgent:false },
    { id:"e3", title:"Sport",          date:"Do, 10. Apr", time:"18:00", icon:"🏃", urgent:false },
  ],
  2: [
    { id:"e4", title:"Arzttermin Max", date:"Mo, 07. Apr", time:"10:30", icon:"🏥", urgent:true  },
    { id:"e5", title:"Elternabend",    date:"Mi, 09. Apr", time:"19:00", icon:"🏫", urgent:false },
    { id:"e6", title:"Autowerkstatt",  date:"Fr, 11. Apr", time:"08:00", icon:"🔧", urgent:false },
  ],
  3: [
    { id:"e7", title:"Klavierunterricht", date:"Heute",       time:"14:00", icon:"🎹", urgent:true  },
    { id:"e8", title:"Schulfest",         date:"Fr, 12. Apr", time:"14:00", icon:"🎉", urgent:false },
    { id:"e9", title:"Freundin Mia",      date:"Sa, 13. Apr", time:"15:00", icon:"👯", urgent:false },
  ],
  4: [
    { id:"ea", title:"Fußballtraining", date:"Heute",        time:"16:00", icon:"⚽", urgent:true  },
    { id:"eb", title:"Arzttermin",      date:"Mo, 07. Apr",  time:"10:30", icon:"🏥", urgent:false },
    { id:"ec", title:"Schulausflug",    date:"Mi, 09. Apr",  time:"07:30", icon:"🚌", urgent:false },
  ],
};

const INIT_POSTS = [
  { id:1, memberId:1, type:"status",   pinned:true,  date:"heute",   time:"08:15", reads:[2,3], comments:[{memberId:3,text:"Yeeees!! 🎉",time:"08:22"}], content:"Heute Abend gibt es selbstgemachte Pizza! 🍕 Bitte alle bis 18:30 zuhause." },
  { id:2, memberId:3, type:"event",    pinned:false, date:"heute",   time:"07:45", reads:[1,2,4], comments:[], eventDate:"Fr, 12. Apr", eventTime:"14:00", content:"Schulfest nächsten Freitag! Ich brauche Kuchen 🎂 Wer backt mit mir?" },
  { id:3, memberId:2, type:"reminder", pinned:false, date:"gestern", time:"20:00", reads:[1], comments:[{memberId:1,text:"Danke! Ist notiert ✓",time:"20:10"}], eventDate:"Mo, 07. Apr", eventTime:"10:30", content:"Arzttermin für Max nicht vergessen! 🏥" },
  { id:4, memberId:4, type:"status",   pinned:false, date:"heute",   time:"07:30", reads:[1,2], comments:[], content:"Training heute um 16 Uhr, komme später ⚽" },
];

const INIT_STORIES: Record<number, any[]> = {
  1: [
    { id:"s1", memberId:1, type:"text", text:"Guten Morgen Familie! ☀️", bg:"#C8522A", time:"07:30", seen:[] },
    { id:"s2", memberId:1, type:"text", text:"Pizza heute Abend! 🍕🎉",  bg:"#8B3A20", time:"08:00", seen:[2] },
  ],
  2: [{ id:"s3", memberId:2, type:"text", text:"Unterwegs zum Arzt 🏥", bg:"#3A6DBF", time:"09:15", seen:[1,3] }],
  3: [
    { id:"s4", memberId:3, type:"text", text:"Klavier heute war super 🎹", bg:"#3D8C6E", time:"15:30", seen:[] },
    { id:"s5", memberId:3, type:"text", text:"Wer kommt zum Schulfest? 🎉", bg:"#2A6B50", time:"16:00", seen:[1] },
  ],
  4: [],
};

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

function PostCard({ post, gm, active, expanded, onExpand, onRead, comment, onCommentChange, onComment }:
  { post:any, gm:(id:number)=>any, active:number, expanded:boolean, onExpand:()=>void, onRead:()=>void, comment:string, onCommentChange:(s:string)=>void, onComment:()=>void }) {
  const mem  = gm(post.memberId);
  const read = post.reads.includes(active);
  const tc   = TYPE[post.type];
  return (
    <div style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:14,overflow:"hidden"}}>
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
      {post.reads.length>0&&<div style={{padding:"0 13px 9px",display:"flex",alignItems:"center",gap:5}}><div style={{display:"flex"}}>{post.reads.slice(0,4).map((id:number)=><div key={id} style={{width:18,height:18,borderRadius:"50%",overflow:"hidden",marginLeft:-3,border:`1.5px solid ${T.bg1}`}}><Av m={gm(id)} s={18}/></div>)}</div><span style={{fontSize:10,color:T.txt2,fontFamily:"monospace"}}>{post.reads.length} gelesen</span></div>}
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
  const [tab, setTab]             = useState("dashboard");
  const [members, setMembers]     = useState(INIT_MEMBERS);
  const [memberEvents, setMemberEvents] = useState<Record<number,any[]>>(MEMBER_EVENTS);
  const [posts, setPosts]         = useState<any[]>(INIT_POSTS);
  const [stories, setStories]     = useState<Record<number,any[]>>(INIT_STORIES);
  const [viewStory, setViewStory] = useState<{memberId:number,index:number}|null>(null);
  const [addStory, setAddStory]   = useState(false);
  const [newStory, setNewStory]   = useState({ type:"text", text:"", bg:STORY_BG_OPTIONS[0], photo:null as string|null });
  const [compose, setCompose]     = useState(false);
  const [newPost, setNewPost]     = useState({ content:"", type:"status", memberId:1 });
  const [expanded, setExpanded]   = useState<number|null>(null);
  const [comment, setComment]     = useState("");
  const [active, setActive]       = useState(1);
  const [editPhoto, setEditPhoto] = useState<number|null>(null);
  const [addEventModal, setAddEventModal] = useState(false);
  const [newEvent, setNewEvent]   = useState({ title:"", date:"", time:"", icon:"📅", forMemberId:1 });
  const [shopItems, setShopItems] = useState<any[]>([
    { id:"sh1", text:"Milch", qty:"2L",  done:false, memberId:1, cat:"🥛" },
    { id:"sh2", text:"Brot",  qty:"1",   done:false, memberId:2, cat:"🍞" },
    { id:"sh3", text:"Äpfel", qty:"1kg", done:true,  memberId:3, cat:"🍎" },
    { id:"sh4", text:"Pasta", qty:"500g",done:false, memberId:4, cat:"🍝" },
    { id:"sh5", text:"Käse",  qty:"",    done:false, memberId:1, cat:"🧀" },
  ]);
  const [newItem, setNewItem]     = useState({ text:"", qty:"", cat:"🛒" });
  const [shopFilter, setShopFilter] = useState("all");
  const [calMonth, setCalMonth]   = useState(new Date());
  const [calSelected, setCalSelected] = useState(TODAY_ISO);
  const [now, setNow]             = useState(new Date());

  useEffect(() => { const t = setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); }, []);

  const hh = now.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
  const ss = String(now.getSeconds()).padStart(2,"0");
  const dd = now.toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"});
  const ch = now.getHours()+now.getMinutes()/60;
  const gm = (id:number) => members.find(m=>m.id===id);
  const am = gm(active);

  const toggleRead = (id:number) => setPosts(p=>p.map(x=>{
    if(x.id!==id) return x;
    const r=x.reads.includes(active);
    return {...x,reads:r?x.reads.filter((v:number)=>v!==active):[...x.reads,active]};
  }));

  const addComment = (id:number) => {
    if(!comment.trim()) return;
    setPosts(p=>p.map(x=>x.id===id?{...x,comments:[...x.comments,{memberId:active,text:comment,time:hh}]}:x));
    setComment("");
  };

  const submitPost = () => {
    if(!newPost.content.trim()) return;
    setPosts(p=>[{id:Date.now(),memberId:newPost.memberId,type:newPost.type,content:newPost.content,time:hh,date:"heute",reads:[],comments:[],pinned:false},...p]);
    setNewPost({content:"",type:"status",memberId:active});
    setCompose(false);
  };

  const uploadPhoto = (memberId:number, file:File) => {
    const r=new FileReader();
    r.onload=e=>setMembers(p=>p.map(m=>m.id===memberId?{...m,photo:e.target?.result as string}:m));
    r.readAsDataURL(file);
    setEditPhoto(null);
  };

  const submitEvent = (memberId?:number) => {
    const targetId = memberId || newEvent.forMemberId;
    if(!newEvent.title.trim()) return;
    const ev = { id:"e"+Date.now(), title:newEvent.title, date:newEvent.date||"Demnächst", time:newEvent.time||"–", icon:newEvent.icon||"📅", urgent:false, addedBy:active };
    setMemberEvents(p=>({...p,[targetId]:[ev,...(p[targetId]||[])]}));
    setNewEvent({title:"",date:"",time:"",icon:"📅",forMemberId:active});
    setAddEventModal(false);
  };

  const removeEvent = (memberId:number, eventId:string) => {
    setMemberEvents(p=>({...p,[memberId]:(p[memberId]||[]).filter((e:any)=>e.id!==eventId)}));
  };

  const allStoriesOf = (memberId:number) => stories[memberId] || [];
  const hasUnseen    = (memberId:number) => allStoriesOf(memberId).some((s:any)=>!s.seen.includes(active));

  const markSeen = (memberId:number, storyId:string) => {
    setStories(p=>({...p,[memberId]:(p[memberId]||[]).map((s:any)=>s.id===storyId&&!s.seen.includes(active)?{...s,seen:[...s.seen,active]}:s)}));
  };

  const submitStory = () => {
    if(newStory.type==="text"&&!newStory.text.trim()) return;
    if(newStory.type==="photo"&&!newStory.photo) return;
    const s = { id:"s"+Date.now(), memberId:active, type:newStory.type, text:newStory.text, bg:newStory.bg, photo:newStory.photo, time:hh, seen:[] };
    setStories(p=>({...p,[active]:[...(p[active]||[]),s]}));
    setNewStory({type:"text",text:"",bg:STORY_BG_OPTIONS[0],photo:null});
    setAddStory(false);
  };

  const deleteStory = (memberId:number, storyId:string) => {
    setStories(p=>({...p,[memberId]:(p[memberId]||[]).filter((s:any)=>s.id!==storyId)}));
  };

  const openStory = (memberId:number) => {
    const list = allStoriesOf(memberId);
    if(!list.length) return;
    const firstUnseen = list.findIndex((s:any)=>!s.seen.includes(active));
    const idx = firstUnseen>=0?firstUnseen:0;
    setViewStory({memberId,index:idx});
    markSeen(memberId,list[idx].id);
  };

  const nextStory = () => {
    if(!viewStory) return;
    const list = allStoriesOf(viewStory.memberId);
    if(viewStory.index<list.length-1) {
      const ni=viewStory.index+1;
      setViewStory({...viewStory,index:ni});
      markSeen(viewStory.memberId,list[ni].id);
    } else {
      const mIdx=members.findIndex(m=>m.id===viewStory.memberId);
      for(let i=mIdx+1;i<members.length;i++) {
        if(allStoriesOf(members[i].id).length){openStory(members[i].id);return;}
      }
      setViewStory(null);
    }
  };

  const prevStory = () => {
    if(!viewStory) return;
    if(viewStory.index>0) {
      const ni=viewStory.index-1;
      setViewStory({...viewStory,index:ni});
      markSeen(viewStory.memberId,allStoriesOf(viewStory.memberId)[ni].id);
    } else setViewStory(null);
  };return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:T.bg0,minHeight:"100vh",maxWidth:430,margin:"0 auto",color:T.txt0}}>
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
              <span style={{color:T.txt0}}>Family</span><span style={{color:T.amber}}>.</span><span style={{color:T.red}}>Feed</span>
            </div>
            <div style={{fontSize:10,color:T.txt2,marginTop:1,fontFamily:"monospace",letterSpacing:0.3}}>{dd}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button className="r" onClick={()=>setCompose(true)} style={{background:T.red,borderRadius:7,padding:"7px 14px",color:"#fff",fontWeight:600,fontSize:12}}>+ Post</button>
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
        <div style={{padding:"12px 12px 0"}}>
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
              <button className="r" onClick={()=>{setNewEvent({title:"",date:"",time:"",icon:"📅",forMemberId:members[0].id});setAddEventModal(true);}} style={{background:T.red,borderRadius:8,padding:"7px 13px",color:"#fff",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:14}}>+</span> Termin
              </button>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:T.txt2,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8}}>Heute offen</div>
                <div style={{fontSize:20,fontWeight:700,color:T.txt0}}>{Object.values(memberEvents).flat().filter((e:any)=>e.date==="Heute").length}</div>
              </div>
            </div>
          </div>

          {/* PERSON CARDS */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            {members.map(m=>{
              const evs=(memberEvents[m.id]||[]).slice(0,3);
              const todayCount=evs.filter((e:any)=>e.date==="Heute").length;
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
                    <button className="r" onClick={()=>{setNewEvent({title:"",date:"",time:"",icon:"📅",forMemberId:m.id});setAddEventModal(true);}} style={{width:22,height:22,borderRadius:6,background:m.color+"22",border:`1px solid ${m.color}55`,color:m.color,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>+</button>
                  </div>
                  <div style={{flex:1,padding:"6px 0"}}>
                    {evs.length===0&&<div style={{padding:"12px",textAlign:"center",fontSize:11,color:T.txt2}}>Keine Termine</div>}
                    {evs.map((ev:any,i:number)=>{
                      const addedBy=ev.addedBy?gm(ev.addedBy):null;
                      return (
                        <div key={ev.id} className="ev-row" style={{display:"flex",alignItems:"center",gap:7,padding:"7px 12px",borderBottom:i<evs.length-1?`1px solid ${m.color}18`:"none"}}>
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
                  {(memberEvents[m.id]||[]).length>3&&<div style={{padding:"6px 12px",borderTop:`1px solid ${m.color}22`,textAlign:"center",background:m.color+"0A"}}><span style={{fontSize:10,color:m.color,fontWeight:600}}>+{(memberEvents[m.id]||[]).length-3} weitere</span></div>}
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
        <div style={{padding:"12px 12px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
            {members.map(m=>(
              <button key={m.id} className="r" onClick={()=>setActive(m.id)} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 11px",borderRadius:8,background:active===m.id?m.color+"18":T.bg2,border:`1px solid ${active===m.id?m.color+"44":T.line}`,whiteSpace:"nowrap"}}>
                <Av m={m} s={22}/><span style={{fontSize:12,fontWeight:active===m.id?600:400,color:active===m.id?m.color:T.txt1}}>{m.name}</span>
              </button>
            ))}
          </div>
          {[...posts.filter((p:any)=>p.pinned),...posts.filter((p:any)=>!p.pinned)].map((post:any)=>(
            <PostCard key={post.id} post={post} gm={gm} active={active}
              expanded={expanded===post.id}
              onExpand={()=>setExpanded(expanded===post.id?null:post.id)}
              onRead={()=>toggleRead(post.id)}
              comment={expanded===post.id?comment:""}
              onCommentChange={setComment}
              onComment={()=>addComment(post.id)}/>
          ))}
          <div style={{height:40}}/>
        </div>
      )}{/* KALENDER */}
      {tab==="cal"&&(()=>{
        const allEvs=Object.entries(memberEvents).flatMap(([mid,evs])=>
          (evs as any[]).map(ev=>({...ev,memberId:parseInt(mid),isoDate:parseEventDate(ev.date)}))
        ).filter(e=>e.isoDate);
        const eventsForDay=(iso:string)=>allEvs.filter(e=>e.isoDate===iso);
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
          <div style={{padding:"12px 12px",display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:14,padding:"12px 16px"}}>
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
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:T.txt0}}>{selLabel}</div>
                  <div style={{fontSize:10,color:T.txt2,marginTop:1}}>{selEvs.length===0?"Keine Termine":`${selEvs.length} Termin${selEvs.length>1?"e":""}`}</div>
                </div>
                <button className="r" onClick={()=>{const d=new Date(calSelected);const label=d.toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short"});setNewEvent({title:"",date:label,time:"",icon:"📅",forMemberId:members[0].id});setAddEventModal(true);}} style={{background:T.red,borderRadius:8,padding:"7px 13px",color:"#fff",fontWeight:700,fontSize:12}}>+ Termin</button>
              </div>
              {selEvs.length===0
                ?<div style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:14,padding:"28px 16px",textAlign:"center"}}><div style={{fontSize:28,marginBottom:8}}>📅</div><div style={{fontSize:14,color:T.txt2}}>Kein Termin an diesem Tag</div></div>
                :<div style={{display:"flex",flexDirection:"column",gap:8}}>{selEvs.sort((a:any,b:any)=>a.time.localeCompare(b.time)).map((ev:any)=>{
                  const mem=members.find(m=>m.id===ev.memberId);
                  const addedBy=ev.addedBy?members.find(m=>m.id===ev.addedBy):null;
                  return (
                    <div key={ev.id} className="in" style={{background:T.bg1,border:`1.5px solid ${mem?.color}33`,borderRadius:14,padding:"12px 14px",display:"flex",gap:12,alignItems:"center",borderLeft:`4px solid ${mem?.color}`}}>
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
        const addShopItem=()=>{if(!newItem.text.trim())return;setShopItems(p=>[...p,{id:"sh"+Date.now(),text:newItem.text,qty:newItem.qty,done:false,memberId:active,cat:newItem.cat}]);setNewItem({text:"",qty:"",cat:"🛒"});};
        const toggleDone=(id:string)=>setShopItems(p=>p.map((x:any)=>x.id===id?{...x,done:!x.done}:x));
        const removeItem=(id:string)=>setShopItems(p=>p.filter((x:any)=>x.id!==id));
        return (
          <div style={{padding:"12px 12px",display:"flex",flexDirection:"column",gap:10}}>
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
              {done.length>0&&<button className="r" onClick={()=>setShopItems(p=>p.filter((x:any)=>!x.done))} style={{marginLeft:"auto",padding:"6px 12px",borderRadius:20,background:T.redT,color:T.red,fontWeight:600,fontSize:12,border:`1px solid ${T.redB}`}}>Erledigte löschen</button>}
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
        <div style={{padding:"12px 12px",display:"flex",flexDirection:"column",gap:10}}>
          {members.map(m=>{
            const myPosts=posts.filter((p:any)=>p.memberId===m.id);
            const reads=myPosts.reduce((s:number,p:any)=>s+p.reads.length,0);
            const isActive=active===m.id;
            return (
              <div key={m.id} className="in" style={{background:T.bg1,border:`1px solid ${isActive?m.color+"44":T.line}`,borderRadius:14,overflow:"hidden"}}>
                <div style={{padding:"16px 16px 14px",display:"flex",gap:13,alignItems:"center"}}>
                  <div style={{position:"relative"}}>
                    <Av m={m} s={52}/>
                    <button className="r" onClick={()=>setEditPhoto(editPhoto===m.id?null:m.id)} style={{position:"absolute",bottom:-1,right:-1,width:19,height:19,borderRadius:"50%",background:T.bg3,border:`1.5px solid ${T.line2}`,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",color:T.txt1}}>✎</button>
                  </div>
                  <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:T.txt0}}>{m.name}</div><div style={{fontSize:11,color:T.txt2,marginTop:1}}>{m.role}</div></div>
                  <button className="r" onClick={()=>setActive(m.id)} style={{background:isActive?m.color:T.bg3,border:`1px solid ${isActive?m.color:T.line2}`,borderRadius:7,padding:"6px 13px",fontSize:11,fontWeight:600,color:isActive?"#fff":T.txt1}}>
                    {isActive?"✓ Aktiv":"Wählen"}
                  </button>
                </div>
                {editPhoto===m.id&&<PhotoPanel m={m} onUpload={f=>uploadPhoto(m.id,f)} onRemove={()=>{setMembers(p=>p.map(x=>x.id===m.id?{...x,photo:null}:x));setEditPhoto(null);}} onClose={()=>setEditPhoto(null)}/>}
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
          <div style={{height:40}}/>
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
                    <input value={newEvent.date} onChange={e=>setNewEvent(p=>({...p,date:e.target.value}))} placeholder="z.B. Mo, 14. Apr" style={{width:"100%",background:T.bg3,border:`1px solid ${T.line2}`,borderRadius:10,padding:"11px 13px",fontSize:13,color:T.txt0}}/>
                  </div>
                  <div style={{width:100}}>
                    <SLabel>Uhrzeit</SLabel>
                    <input value={newEvent.time} onChange={e=>setNewEvent(p=>({...p,time:e.target.value}))} placeholder="10:30" style={{width:"100%",background:T.bg3,border:`1px solid ${T.line2}`,borderRadius:10,padding:"11px 13px",fontSize:13,color:T.txt0}}/>
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
              {viewStory.memberId===active&&<button className="r" onClick={()=>{deleteStory(viewStory.memberId,s.id);setViewStory(null);}} style={{color:"rgba(255,255,255,0.65)",fontSize:11,padding:"4px 10px",borderRadius:6,background:"rgba(255,255,255,0.12)",fontWeight:600}}>Löschen</button>}
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
                <div style={{display:"flex",marginLeft:2}}>{s.seen.map((sid:number)=><div key={sid} style={{width:22,height:22,borderRadius:"50%",overflow:"hidden",marginLeft:-5,border:"2px solid #000"}}><Av m={gm(sid)} s={22}/></div>)}</div>
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
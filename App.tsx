import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  useSession, useProfile, useDashboardSummary, useServers, useServerSettings,
  usePassProducts, usePasses, useTickets, useChatRooms, useChatMessages,
  useOwnerAccess, useOwnerSummary, signInWithDiscord, signOut,
  useOwnerUsers, useOwnerServers, useOwnerPayments, useOwnerProducts, useOwnerTickets,
  useOwnerTicketMessages, useOwnerAudit, useOwnerMaintenance, ownerAdmin,
  requestServerRegistration, cancelServerRegistration, saveServerSettings,
  addBlockedWord, deleteBlockedWord, markRoomRead, editChatMessage, deleteChatMessage,
  requestPass, createTicket, sendChatMessage, updateProfilePreferences, runOwnerBootstrap,
} from '@/lib/tend-data';
import {
  Route, Switch, useLocation, useParams, Router as WouterRouter, Link,
} from 'wouter';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, Bell, Check, ChevronDown, ChevronRight,
  CircleHelp, Command, FileText, Hash, Headphones, LayoutDashboard, LogOut,
  Menu, MessageSquareText, Moon, Plus, Radio, Settings, Shield, ShieldCheck, Server,
  Sun, Ticket, X, Search, Trash2, Pencil,
} from 'lucide-react';

const queryClient = new QueryClient();
type AnyRecord = Record<string, any>;
const cx = (...s: Array<string | false | null | undefined>) => s.filter(Boolean).join(' ');
const get = (r: any, fallback?: any) => r?.data ?? r?.value ?? fallback;
const pending = (r: any) => !!(r?.isLoading || r?.isPending || r?.loading);
const problem = (r: any) => r?.error || (r?.status === 'error' ? r : null);
const messageOf = (e: any) => typeof e === 'string' ? e : e?.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const run = async (fn: any, ...args: any[]) => {
  try {
    const result = await fn(...args);
    if (result?.error) throw result.error;
    return result;
  } catch (e) { throw e; }
};
const dateLabel = (v?: string) => v ? new Date(v).toLocaleDateString('ko-KR', { year:'numeric', month:'short', day:'numeric' }) : '—';
const statusText: Record<string, string> = {
  active:'정상 운영', pending:'확인 중', requested:'확인 중', approved:'승인됨', rejected:'반려됨', cancelled:'취소됨',
  expired:'만료됨', paid:'이용 중', refunded:'환불됨', open:'접수됨', in_progress:'처리 중', resolved:'답변 완료', closed:'종료됨',
  connected:'연결됨', online:'온라인', disconnected:'연결 안 됨', offline:'오프라인', published:'게시됨', draft:'초안', paused:'일시 중지',
};

function Brand({ light=false }: {light?:boolean}) {
  return <Link href="/" className={cx('brand',light&&'brand-light')} aria-label="TEND 홈"><span className="brand-mark">T</span><span>TEND</span><span className="brand-dot">.</span></Link>;
}
function Button({ children, onClick, href, variant='primary', className='', type='button', disabled=false, ...props }: any) {
  const cls = cx('btn', `btn-${variant}`, className);
  if (href) return <Link href={href} className={cls} {...props}>{children}</Link>;
  return <button type={type} className={cls} onClick={onClick} disabled={disabled} {...props}>{children}</button>;
}
function SectionTitle({ eyebrow, title, description, action }: any) {
  return <div className="section-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</div>;
}
function Card({ children, className='' }: {children:ReactNode;className?:string}) { return <section className={cx('panel',className)}>{children}</section>; }
function Status({ value }: {value?:string}) {
  const v = value || 'unknown';
  const tone = ['active','approved','connected','resolved','published'].includes(v) ? 'good' : ['pending','in_progress','open'].includes(v) ? 'wait' : ['rejected','expired','disconnected'].includes(v) ? 'bad' : 'neutral';
  return <span className={`status status-${tone}`}><i />{statusText[v] || (v==='unknown'?'상태 확인 중':v)}</span>;
}
function NoticeBox({ kind='info', children }: {kind?:string;children:ReactNode}) { return <div className={`notice notice-${kind}`} role="status">{children}</div>; }
function Loading({ label='정보를 불러오고 있습니다' }: {label?:string}) {
  return <div className="loading-block" aria-label={label}><div className="skeleton sk-title"/><div className="skeleton sk-line"/><div className="skeleton sk-line short"/><span>{label}</span></div>;
}
function DataState({ result, children, empty=false, emptyText='아직 등록된 항목이 없습니다.' }: any) {
  if (pending(result)) return <Loading/>;
  if (problem(result)) return <NoticeBox kind="error"><CircleHelp size={18}/><span>{messageOf(problem(result))}</span></NoticeBox>;
  if (empty) return <div className="empty"><span className="empty-icon"><Command size={20}/></span><strong>{emptyText}</strong><p>연결이 완료되면 이곳에서 관리할 수 있습니다.</p></div>;
  return children;
}
const navItems = [
  {href:'/dashboard',label:'대시보드',icon:LayoutDashboard},
  {href:'/servers',label:'서버 관리',icon:Server},
  {href:'/passes',label:'패스',icon:ShieldCheck},
  {href:'/chat',label:'상담 채팅',icon:MessageSquareText},
  {href:'/tickets',label:'문의 티켓',icon:Ticket},
];

function AppShell({ children }: {children:ReactNode}) {
  const [location] = useLocation();
  const sessionResult:any = useSession();
  const profileResult:any = useProfile();
  const ownerAccess:any = useOwnerAccess();
  const discordProfile = sessionResult?.session?.user?.user_metadata || {};
  const profile = get(profileResult) || {
    displayName: discordProfile.full_name || discordProfile.name,
    username: discordProfile.preferred_username || discordProfile.username,
  };
  const [mobileNav,setMobileNav] = useState(false);
  const [dark,setDark] = useState(()=>{try{return localStorage.getItem('tend-theme')==='dark'}catch{return false}});
  useEffect(()=>{document.documentElement.classList.toggle('dark',dark);try{localStorage.setItem('tend-theme',dark?'dark':'light')}catch{}},[dark]);
  useEffect(()=>{const preference=profileResult?.data?.theme;if(preference==='dark'||preference==='light')setDark(preference==='dark')},[profileResult?.data?.theme]);
  return <div className="app-frame">
    <aside className={cx('sidebar',mobileNav&&'sidebar-open')}>
      <div className="side-top"><Brand light/><button className="mobile-close" onClick={()=>setMobileNav(false)} aria-label="메뉴 닫기"><X size={19}/></button></div>
      <div className="workspace-tag"><span className="workspace-symbol">T</span><span><b>내 워크스페이스</b><small>Discord 운영 콘솔</small></span><ChevronDown size={14}/></div>
      <div className="nav-caption">관리</div>
      <nav className="side-nav" aria-label="주 메뉴">{navItems.map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={()=>setMobileNav(false)} className={cx('nav-link',(location===href||location.startsWith(`${href}/`))&&'nav-active')}><Icon size={18}/><span>{label}</span>{href==='/tickets'&&<span className="nav-count">↗</span>}</Link>)}</nav>
      <div className="nav-caption lower">계정</div>
       <nav className="side-nav"><Link href="/settings" className={cx('nav-link',location==='/settings'&&'nav-active')}><Settings size={18}/><span>설정</span></Link>{ownerAccess?.data===true&&<Link href="/owner" className={cx('nav-link',location==='/owner'&&'nav-active')}><Shield size={18}/><span>운영자 도구</span></Link>}</nav>
      <div className="sidebar-bottom">
        <div className="connection"><span className="connection-dot"/><span>서비스 연결 상태</span><span className="mono">—</span></div>
        <div className="user-chip"><div className="user-avatar">{(profile?.displayName||profile?.username||'T').slice(0,1).toUpperCase()}</div><span className="user-info"><b>{profile?.displayName||profile?.username||'Discord 계정'}</b><small>{profile?.username?`@${profile.username}`:'계정 상태 확인 중'}</small></span><button title="로그아웃" aria-label="로그아웃" className="icon-button" onClick={()=>{void run(signOut)}}><LogOut size={16}/></button></div>
      </div>
    </aside>
    {mobileNav&&<button className="nav-scrim" aria-label="메뉴 닫기" onClick={()=>setMobileNav(false)}/>}
    <main className="main-column">
      <header className="topbar"><button className="mobile-menu icon-button" aria-label="메뉴 열기" onClick={()=>setMobileNav(true)}><Menu size={19}/></button><div className="breadcrumb">TEND <ChevronRight size={13}/><span>{navItems.find(i=>location.startsWith(i.href))?.label || (location==='/settings'?'설정':location==='/owner'?'운영자 도구':'홈')}</span></div><div className="top-actions"><span className="top-status"><i/>서비스 상태 확인</span><button className="icon-button theme-toggle" title={dark?'라이트 모드':'다크 모드'} onClick={()=>setDark(v=>!v)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button><Link href="/settings" className="top-avatar">{(profile?.displayName||'T').slice(0,1).toUpperCase()}</Link></div></header>
      <div className="page-content">{children}</div>
      <footer className="app-footer"><span>© TEND · Discord 서버 관리를 더 간단하게.</span><span>계정 정보는 Discord 인증을 통해 연결됩니다.</span></footer>
    </main>
  </div>;
}
function PublicPage() {
  const [location] = useLocation();
  const session:any = useSession();
  const loggedIn = !!session?.session?.user?.id;
  return <div className="public-page">
    <header className="public-nav"><Brand/><div className="public-nav-right"><a href="#features">주요 기능</a><Link href={loggedIn?'/dashboard':'/login'} className="text-link">{loggedIn?'콘솔 열기':'로그인'}</Link><Button href={loggedIn?'/dashboard':'/login'}>{loggedIn?'대시보드':'Discord로 시작'}<ArrowRight size={16}/></Button></div></header>
    <main>
      <section className="hero">
        <div className="hero-copy rise"><div className="hero-kicker"><span className="pulse-dot"/> SERVER OPERATIONS, IN ORDER</div><h1>Discord 서버 관리를<br/><em>더 간단하게.</em></h1><p>여러 커뮤니티의 설정부터 문의와 패스까지.<br className="desktop-break"/> 운영에 필요한 일을 한곳에서 정확하게.</p><div className="hero-actions"><Button href={loggedIn?'/dashboard':'/login'}>Discord 계정으로 시작하기<ArrowRight size={16}/></Button><Link href="/servers" className="secondary-link">기능 둘러보기 <ArrowDownRight size={15}/></Link></div><div className="hero-proof"><div className="mini-avatars"><span>T</span><span>서</span><span>운</span></div><span>서버 운영자를 위한 실무 콘솔</span></div></div>
        <div className="hero-visual rise" aria-label="TEND 콘솔 미리보기"><div className="visual-top"><span className="visual-brand"><b>T</b> TEND</span><span className="visual-indicator"><i/> 관리 콘솔</span></div><div className="visual-title"><small>WORKSPACE OVERVIEW</small><strong>운영 현황</strong><span>커뮤니티 상태를 한눈에 확인하세요.</span></div><div className="visual-stat-row"><div><small>등록 서버</small><b>—</b><span>연결된 Discord 서버</span></div><div><small>진행 중 문의</small><b>—</b><span>확인할 티켓</span></div></div><div className="visual-list"><div className="visual-row"><span className="server-glyph">N</span><span><b>서버 운영 현황</b><small>상태 연결 후 표시됩니다</small></span><span className="visual-pending">대기</span></div><div className="visual-row"><span className="server-glyph blue">S</span><span><b>모더레이션 규칙</b><small>설정을 한곳에서 관리</small></span><span className="visual-check"><Check size={14}/></span></div></div><div className="visual-bottom"><span><Activity size={14}/> TEND 운영 도구</span><span className="mono">01 / 05</span></div></div>
      </section>
      <section className="feature-band" id="features"><div className="feature-intro"><span className="eyebrow">ONE CONSOLE, CLEAR CONTROL</span><h2>운영의 흐름을<br/>끊지 않도록.</h2><p>반복되는 설정과 응대를 정리하고, 서버마다 필요한 관리에 집중하세요.</p></div><div className="feature-grid">
        <article className="feature-item"><span className="feature-index">01</span><div className="feature-icon"><Server size={20}/></div><h3>여러 서버를 한곳에서</h3><p>서버를 등록하고 봇 연결 및 운영 상태를 확인합니다.</p><Link href="/servers">서버 관리 보기 <ArrowRight size={14}/></Link></article>
        <article className="feature-item"><span className="feature-index">02</span><div className="feature-icon"><ShieldCheck size={20}/></div><h3>규칙을 일관되게</h3><p>차단 단어와 자동화 규칙을 서버별로 설정합니다.</p><Link href="/servers">설정 시작하기 <ArrowRight size={14}/></Link></article>
        <article className="feature-item"><span className="feature-index">03</span><div className="feature-icon"><Headphones size={20}/></div><h3>문의와 대화를 정돈</h3><p>상담 채팅과 티켓의 진행 상황을 놓치지 않습니다.</p><Link href="/tickets">지원 확인하기 <ArrowRight size={14}/></Link></article>
      </div></section>
      <section className="feature-note"><div className="note-mark">T</div><div><span className="eyebrow">BUILT FOR MODERATORS</span><h2>필요한 정보만, 필요한 순간에.</h2><p>연결되지 않은 정보는 숨기지 않고 상태 그대로 알려드립니다. TEND는 운영자의 확인과 결정이 필요한 순간을 분명하게 보여줍니다.</p></div><Button href={loggedIn?'/dashboard':'/login'} variant="outline">운영 콘솔 시작 <ArrowRight size={15}/></Button></section>
      <section className="public-bottom"><div><span className="eyebrow">TEND · SERVER OPERATIONS</span><h2>서버 운영의 다음 단계를<br/>가볍게 시작하세요.</h2></div><Button href={loggedIn?'/dashboard':'/login'}>Discord로 로그인<ArrowRight size={16}/></Button></section>
    </main>
    <footer className="public-footer"><Brand/><span>Discord 서버 관리를 더 간단하게.</span><span className="mono">KOREA · TEND</span></footer>
  </div>;
}
function LoginPage() {
  const params:any = new URLSearchParams(window.location.search);
  const error = params.get('error') || params.get('message');
  const [busy,setBusy]=useState(false); const [issue,setIssue]=useState('');
  const doLogin=async()=>{setBusy(true);setIssue('');try{const r=await run(signInWithDiscord);if(r?.url)window.location.assign(r.url);else if(r?.redirectTo)window.location.assign(r.redirectTo);else if(r?.error)throw r.error;}catch(e){setIssue(messageOf(e))}finally{setBusy(false)}};
  return <div className="login-page"><div className="login-side"><Brand light/><div className="login-quote"><span className="eyebrow">TEND OPERATIONS</span><h1>서버 운영에<br/>필요한 것을<br/><em>한 곳에서.</em></h1><p>Discord 커뮤니티의 설정, 응대, 운영 현황을 명확하게 관리하세요.</p></div><div className="login-side-foot"><span className="mono">TEND / 2025</span><span>한국어 운영 콘솔</span></div></div><div className="login-main"><Link href="/" className="back-home"><ArrowLeft size={16}/> 홈으로</Link><div className="login-card"><div className="login-symbol">T</div><span className="eyebrow">SIGN IN TO TEND</span><h2>계속하려면 로그인하세요</h2><p>Discord 계정으로 안전하게 연결합니다.</p>{error&&<NoticeBox kind="error"><CircleHelp size={17}/><span>Discord 인증에 실패했습니다. {decodeURIComponent(error)}</span></NoticeBox>}{issue&&<NoticeBox kind="error"><CircleHelp size={17}/><span>{issue}</span></NoticeBox>}<Button onClick={doLogin} disabled={busy} className="login-button"><span className="discord-mark">◈</span>{busy?'Discord로 연결 중…':'Discord로 계속하기'}<ArrowRight size={16}/></Button><div className="login-divider"><span>안전한 인증</span></div><p className="login-legal">로그인하면 Discord 계정 정보가 TEND에 전달됩니다.<br/>서비스를 이용하기 전에 서버 운영 권한을 확인합니다.</p><Link href="/" className="login-help">로그인에 문제가 있나요? 홈으로 돌아가기 <ArrowRight size={13}/></Link></div><span className="login-copyright">© TEND. Discord 서버 관리를 더 간단하게.</span></div></div>;
}
function AuthGate({ children }: {children:ReactNode}) {
  const session:any=useSession();
  if(session?.loading) return <div className="auth-loading"><Loading label="로그인 상태를 확인하고 있습니다"/></div>;
  if(session?.configured===false) return <AppShell><div className="narrow"><SectionTitle eyebrow="SETUP REQUIRED" title="인증 연결을 준비하고 있습니다"/><NoticeBox>Discord 로그인을 사용하려면 인증 서비스 설정이 필요합니다. 현재는 로그인 세션을 확인할 수 없습니다.</NoticeBox></div></AppShell>;
  if(problem(session)) return <AppShell><div className="narrow"><SectionTitle eyebrow="SESSION" title="계정 상태를 확인할 수 없습니다"/><NoticeBox kind="error">{messageOf(problem(session))}</NoticeBox><Button href="/login">다시 로그인</Button></div></AppShell>;
  if(!session?.session?.user?.id) return <LoginPage/>;
  return <AppShell>{children}</AppShell>;
}
function Dashboard() {
  const summary:any=useDashboardSummary(); const profileResult:any=useProfile(); const profile=get(profileResult)||{};
  const serversResult:any=useServers(); const registeredServers=get(serversResult,[])||[];
  const s=get(summary)||{};
  const metrics=[{label:'등록 서버',value:s.serverCount,icon:Server,foot:'관리 중인 Discord 커뮤니티',href:'/servers'},{label:'활성 패스',value:s.activePassCount,icon:ShieldCheck,foot:'이용 중인 서버 패스',href:'/passes'},{label:'진행 중 문의',value:s.openTicketCount,icon:Ticket,foot:'확인이 필요한 지원 요청',href:'/tickets'},{label:'새 공지',value:s.recentNotices?.length,icon:Bell,foot:'최근 게시된 안내',href:'/dashboard'}];
  return <><SectionTitle eyebrow="WORKSPACE / OVERVIEW" title={`안녕하세요, ${profile.displayName||profile.username||'운영자'}님`} description="오늘 확인이 필요한 서버 운영 현황입니다." action={<span className="date-chip">{new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'})}</span>}/>
    {problem(summary)&&<NoticeBox kind="error">{messageOf(problem(summary))}</NoticeBox>}
    <div className="metric-grid">{metrics.map(({label,value,icon:Icon,foot,href})=><Link href={href} className="metric-card" key={label}><div className="metric-head"><span>{label}</span><Icon size={17}/></div><strong>{pending(summary)?<span className="skeleton metric-skeleton"/>:value??'—'}</strong><small>{foot}</small><ArrowRight className="metric-arrow" size={15}/></Link>)}</div>
    <div className="dashboard-grid"><Card><div className="panel-head"><div><span className="eyebrow">SERVER STATUS</span><h2>서버 운영 현황</h2></div><Link href="/servers" className="panel-link">전체 서버 <ArrowRight size={14}/></Link></div><DataState result={serversResult} empty={!pending(serversResult)&&!registeredServers?.length} emptyText="아직 연결된 서버가 없습니다."><div className="server-list">{(Array.isArray(registeredServers)?registeredServers:[]).slice(0,4).map((server:any)=><div className="server-row" key={server.id}><div className="server-avatar">{(server.name||'S').slice(0,1)}</div><div className="server-meta"><b>{server.name||server.discordServerId}</b><small>{server.discordServerId}</small></div><Status value={server.status}/><Link href={`/servers/${server.id}/settings`} className="row-open" aria-label={`${server.name} 설정`}><ChevronRight size={17}/></Link></div>)}</div></DataState></Card>
      <Card><div className="panel-head"><div><span className="eyebrow">ACCOUNT</span><h2>계정 정보</h2></div><Link href="/settings" className="panel-link">설정 <ArrowRight size={14}/></Link></div>{pending(profileResult)?<Loading/>:problem(profileResult)?<NoticeBox kind="error">{messageOf(problem(profileResult))}</NoticeBox>:<div className="profile-summary"><div className="profile-large">{(profile.displayName||profile.username||'T').slice(0,1)}</div><div><b>{profile.displayName||profile.username||'Discord 계정'}</b><small>{profile.username?`@${profile.username}`:'표시 이름이 아직 없습니다'}</small></div><div className="account-lines"><span>계정 상태 <Status value={profile.accountStatus}/></span><span>마지막 로그인 <b>{dateLabel(profile.lastLoginAt)}</b></span><span>가입일 <b>{dateLabel(profile.createdAt)}</b></span></div></div>}</Card>
    </div><div className="quick-links"><Link href="/servers"><Server size={17}/><span><b>서버 등록</b><small>Discord 서버를 관리 목록에 추가</small></span><ArrowRight size={16}/></Link><Link href="/tickets"><Ticket size={17}/><span><b>새 문의 작성</b><small>운영 지원이 필요할 때</small></span><ArrowRight size={16}/></Link><Link href="/chat"><MessageSquareText size={17}/><span><b>상담 채팅 열기</b><small>상담 담당자와 대화</small></span><ArrowRight size={16}/></Link></div>
    <div className="dashboard-grid dashboard-bottom"><Card><div className="panel-head"><div><span className="eyebrow">LATEST NOTICES</span><h2>서비스 공지</h2></div><Bell size={17}/></div>{pending(summary)?<Loading/>:problem(summary)?<NoticeBox kind="error">{messageOf(problem(summary))}</NoticeBox>:s.recentNotices?.length?<div className="notice-list">{s.recentNotices.map((notice:any)=><article className="notice-row" key={notice.id}><span className="notice-date">{dateLabel(notice.publishedAt||notice.createdAt)}</span><div><b>{notice.title}</b><p>{notice.body}</p></div></article>)}</div>:<div className="empty compact-empty"><div className="empty-icon"><Bell size={17}/></div><strong>게시된 공지가 없습니다.</strong></div>}</Card><Card><div className="panel-head"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>최근 활동</h2></div><Activity size={17}/></div>{pending(summary)?<Loading/>:problem(summary)?<NoticeBox kind="error">{messageOf(problem(summary))}</NoticeBox>:s.recentActivity?.length?<div className="activity-list">{s.recentActivity.map((activity:any)=><div className="activity-row" key={activity.id}><span className="activity-mark"><Activity size={13}/></span><div><b>{activity.label}</b><small>{dateLabel(activity.createdAt)} · {activity.result}</small></div></div>)}</div>:<div className="empty compact-empty"><div className="empty-icon"><Activity size={17}/></div><strong>표시할 활동 내역이 없습니다.</strong></div>}</Card></div>
  </>;
}
function ServersPage() {
  const result:any=useServers(); const servers=get(result,[])||[]; const [serverId,setServerId]=useState(''); const [issue,setIssue]=useState(''); const [success,setSuccess]=useState(''); const [busy,setBusy]=useState(false);
  const submit=async(e:FormEvent)=>{e.preventDefault();setIssue('');setSuccess('');if(!/^\d{15,22}$/.test(serverId.trim())){setIssue('Discord 서버 ID는 15~22자리 숫자여야 합니다.');return}setBusy(true);try{await run(requestServerRegistration,serverId.trim());setServerId('');setSuccess('서버 등록 요청을 접수했습니다. 운영 확인이 끝나면 상태가 업데이트됩니다.');void queryClient.invalidateQueries({queryKey:['servers']});void queryClient.invalidateQueries({queryKey:['dashboard-summary']})}catch(err){setIssue(messageOf(err))}finally{setBusy(false)}};
  const cancel=async(id:string)=>{if(!window.confirm('서버 등록 요청을 취소할까요?'))return;try{await run(cancelServerRegistration,id);void queryClient.invalidateQueries({queryKey:['servers']});void queryClient.invalidateQueries({queryKey:['dashboard-summary']})}catch(e){setIssue(messageOf(e))}};
  return <><SectionTitle eyebrow="COMMUNITIES" title="서버 관리" description="관리할 Discord 서버를 등록하고 연결 상태를 확인합니다."/><div className="servers-layout"><Card className="add-server-card"><div className="panel-head"><div><span className="eyebrow">REGISTER A SERVER</span><h2>서버 추가</h2></div><span className="step-marker">01</span></div><p className="subcopy">Discord 개발자 모드에서 서버 ID를 복사해 입력하세요.</p><form onSubmit={submit} className="form-stack"><label htmlFor="server-id">Discord 서버 ID</label><div className="input-with-action"><input id="server-id" value={serverId} onChange={e=>setServerId(e.target.value)} placeholder="예: 123456789012345678" inputMode="numeric"/><Button type="submit" disabled={busy||!serverId.trim()}>{busy?'요청 중':'등록 요청'}<ArrowRight size={15}/></Button></div><small className="field-hint">서버 소유자 또는 관리자 권한이 필요합니다.</small>{issue&&<NoticeBox kind="error">{issue}</NoticeBox>}{success&&<NoticeBox kind="success">{success}</NoticeBox>}</form><div className="permission-note"><ShieldCheck size={17}/><span>등록 요청은 TEND 운영 정책에 따라 확인 후 처리됩니다.</span></div></Card><div className="server-count-card"><span className="eyebrow">YOUR COMMUNITIES</span><strong>{pending(result)?'—':Array.isArray(servers)?servers.length:'—'}</strong><span>등록 서버</span><div className="count-rule"/><p>서버별 설정과 자동화 규칙을 각각 관리할 수 있습니다.</p></div></div>
    <Card><div className="panel-head"><div><span className="eyebrow">SERVER DIRECTORY</span><h2>등록된 서버</h2></div><span className="table-caption">{Array.isArray(servers)?servers.length:0}개 항목</span></div><DataState result={result} empty={!pending(result)&&!servers?.length} emptyText="등록된 서버가 없습니다."><div className="table-wrap"><table><thead><tr><th>서버</th><th>Discord ID</th><th>등록 상태</th><th>봇 연결</th><th>등록일</th><th><span className="sr-only">관리</span></th></tr></thead><tbody>{(Array.isArray(servers)?servers:[]).map((s:any)=><tr key={s.id}><td><div className="server-cell"><span className="server-avatar">{(s.name||'S').slice(0,1)}</span><b>{s.name||'이름 확인 중'}</b></div></td><td className="mono">{s.discordServerId||'—'}</td><td><Status value={s.status}/></td><td><Status value={s.botStatus}/></td><td>{dateLabel(s.createdAt)}</td><td className="table-actions">{s.status==='requested'&&<button className="text-button danger-text" onClick={()=>cancel(s.id)}>요청 취소</button>}<Link className="row-open" href={`/servers/${s.id}/settings`} aria-label="서버 설정 열기"><ChevronRight size={17}/></Link></td></tr>)}</tbody></table></div></DataState></Card>
  </>;
}
function ServerSettingsPage() {
  const {id=''}=useParams<{id:string}>();
  const result:any=useServerSettings(id);
  const serversResult:any=useServers();
  const servers=get(serversResult,[])||[];
  const server=Array.isArray(servers)?servers.find((item:any)=>item.id===id):null;
  const canConfigure=server?.status==='active';
  const val=get(result)||{};
  const [automod,setAutomod]=useState<AnyRecord>({});
  const [word,setWord]=useState('');
  const [saved,setSaved]=useState(false);
  const [issue,setIssue]=useState('');
  const [wordIssue,setWordIssue]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{if(val?.automod)setAutomod(val.automod)},[val?.serverId]);
  const save=async(e:FormEvent)=>{e.preventDefault();setIssue('');setSaved(false);try{await run(saveServerSettings,id,{automod});setSaved(true);void queryClient.invalidateQueries({queryKey:['server-settings',id]})}catch(err){setIssue(messageOf(err))}};
  const addWord=async()=>{setWordIssue('');if(!word.trim())return;setBusy(true);try{await run(addBlockedWord,id,word);setWord('');void queryClient.invalidateQueries({queryKey:['server-settings',id]})}catch(err){setWordIssue(messageOf(err))}finally{setBusy(false)}};
  const removeWord=async(wordId:string)=>{if(!window.confirm('이 차단 단어를 삭제할까요?'))return;setWordIssue('');try{await run(deleteBlockedWord,id,wordId);void queryClient.invalidateQueries({queryKey:['server-settings',id]})}catch(err){setWordIssue(messageOf(err))}};
  const automodLabels:Record<string,string>={spam:'스팸 메시지',repeatedMessages:'반복 메시지',inviteLinks:'초대 링크',externalLinks:'외부 링크',mentionSpam:'멘션 도배',newAccountLimit:'신규 계정 제한'};
  return <><div className="back-row"><Link href="/servers"><ArrowLeft size={15}/> 서버 목록</Link></div><SectionTitle eyebrow="SERVER CONFIGURATION" title="서버 설정" description={`서버 ID ${id}의 모더레이션과 자동화 규칙을 관리합니다.`}/>{!canConfigure&&<NoticeBox kind="info">서버 승인, 봇 연결, 유효한 이용권 및 관리 권한이 확인된 뒤에 설정을 적용할 수 있습니다. 등록 요청만으로 관리 기능은 활성화되지 않습니다.</NoticeBox>}{problem(result)&&<NoticeBox kind="error">{messageOf(problem(result))}</NoticeBox>}{pending(result)||pending(serversResult)?<Loading/>:<form onSubmit={save} className="settings-layout"><Card><div className="panel-head"><div><span className="eyebrow">MODERATION</span><h2>차단 단어</h2></div><Hash size={18}/></div><p className="subcopy">이 서버에 적용할 차단 단어와 메시지 처리 방식을 관리합니다.</p><div className="blocked-add"><label className="sr-only" htmlFor="blocked-word-input">차단 단어</label><input id="blocked-word-input" value={word} onChange={e=>setWord(e.target.value)} maxLength={100} placeholder="차단할 단어 입력" disabled={!canConfigure||busy}/><Button type="button" onClick={addWord} disabled={!canConfigure||busy||!word.trim()}><Plus size={15}/>{busy?'저장 중':'단어 추가'}</Button></div>{wordIssue&&<NoticeBox kind="error">{wordIssue}</NoticeBox>}{val.blockedWords?.length?<div className="blocked-list">{val.blockedWords.map((entry:any)=><div className="blocked-word" key={entry.id}><span>{entry.word}</span><small>{entry.action?.deleteMessage?'메시지 삭제':'감지 규칙'}</small><button type="button" className="icon-button blocked-remove" aria-label={`${entry.word} 삭제`} disabled={!canConfigure} onClick={()=>removeWord(entry.id)}><Trash2 size={15}/></button></div>)}</div>:<div className="empty compact-empty"><div className="empty-icon"><Hash size={18}/></div><strong>등록된 차단 단어가 없습니다.</strong><p>서버 권한이 확인되면 이곳에서 규칙을 추가할 수 있습니다.</p></div>}</Card><Card><div className="panel-head"><div><span className="eyebrow">AUTOMATION</span><h2>자동화 설정</h2></div><Radio size={18}/></div><p className="subcopy">서버에서 적용할 자동 감지 규칙을 선택합니다.</p>{Object.entries(automodLabels).map(([key,label])=><div className="setting-toggle compact-toggle" key={key}><span><b>{label}</b><small>서버 메시지에서 해당 유형을 감지합니다.</small></span><button type="button" role="switch" aria-label={label} aria-checked={!!automod[key]} disabled={!canConfigure} className={cx('switch',automod[key]&&'switch-on')} onClick={()=>setAutomod((prev:AnyRecord)=>({...prev,[key]:!prev[key]}))}><span/></button></div>)}</Card><div className="form-footer">{val.updatedAt&&<span>마지막 저장 {dateLabel(val.updatedAt)}</span>}<div>{issue&&<span className="inline-error">{issue}</span>}{saved&&<span className="save-success"><Check size={14}/> 자동화 설정 저장됨</span>}<Button type="submit" disabled={!canConfigure}>자동화 저장<Check size={15}/></Button></div></div></form>}</>;
}
function PassesPage() {
  const productsResult:any=usePassProducts(); const passesResult:any=usePasses(); const products=get(productsResult,[])||[]; const passes=get(passesResult,[])||[]; const serversResult:any=useServers(); const servers=get(serversResult,[])||[]; const [target,setTarget]=useState<Record<string,string>>({}); const [issue,setIssue]=useState(''); const [success,setSuccess]=useState(''); const [busyProduct,setBusyProduct]=useState('');
  const buy=async(productId:string)=>{const serverId=target[productId];if(!serverId){setIssue('패스를 적용할 서버를 선택해 주세요.');setSuccess('');return}setIssue('');setSuccess('');setBusyProduct(productId);try{await run(requestPass,productId,serverId);setSuccess('이용권 요청을 접수했습니다. 결제 확인 후 상태가 업데이트됩니다.');void queryClient.invalidateQueries({queryKey:['passes']});void queryClient.invalidateQueries({queryKey:['dashboard-summary']})}catch(e){setIssue(messageOf(e))}finally{setBusyProduct('')}};
  return <><SectionTitle eyebrow="PASSES" title="패스 관리" description="서버에 적용할 수 있는 상품과 요청 내역을 확인합니다."/><div className="pass-intro"><ShieldCheck size={20}/><span>패스 구매 요청 및 이용 상태는 계정에 연결된 정보만 표시됩니다.</span></div>{issue&&<NoticeBox kind="error">{issue}</NoticeBox>}{success&&<NoticeBox kind="success">{success}</NoticeBox>}<h2 className="subsection-heading">이용 가능한 상품</h2><DataState result={productsResult} empty={!pending(productsResult)&&!products?.length} emptyText="현재 이용 가능한 패스 상품이 없습니다."><div className="product-grid">{(Array.isArray(products)?products:[]).filter((p:any)=>p.active!==false).map((p:any)=><Card key={p.id} className="product-card"><div className="product-mark"><ShieldCheck size={18}/></div><span className="eyebrow">TEND PASS</span><h3>{p.name}</h3><div className="product-price">{Number(p.price||0).toLocaleString('ko-KR')}<small>원</small></div><div className="product-duration">{p.durationDays}일 이용</div><label htmlFor={`target-${p.id}`}>적용 서버</label><select id={`target-${p.id}`} className="select-input" value={target[p.id]||''} onChange={e=>setTarget({...target,[p.id]:e.target.value})}><option value="">서버 선택</option>{(Array.isArray(servers)?servers:[]).map((s:any)=><option key={s.id} value={s.id}>{s.name||s.discordServerId}</option>)}</select><Button onClick={()=>buy(p.id)} variant="outline" disabled={busyProduct===p.id}>{busyProduct===p.id?'요청 중':'구매 요청'}<ArrowRight size={14}/></Button></Card>)}</div></DataState>
    <Card className="history-card"><div className="panel-head"><div><span className="eyebrow">REQUEST HISTORY</span><h2>패스 요청 내역</h2></div></div><DataState result={passesResult} empty={!pending(passesResult)&&!passes?.length} emptyText="패스 요청 내역이 없습니다."><div className="table-wrap"><table><thead><tr><th>상품</th><th>서버 ID</th><th>상태</th><th>시작일</th><th>만료일</th></tr></thead><tbody>{(Array.isArray(passes)?passes:[]).map((p:any)=><tr key={p.id}><td>{products.find((x:any)=>x.id===p.productId)?.name||`상품 ${p.productId}`}</td><td className="mono">{p.serverId}</td><td><Status value={p.status}/></td><td>{dateLabel(p.startsAt)}</td><td>{dateLabel(p.expiresAt)}</td></tr>)}</tbody></table></div></DataState></Card>
  </>;
}
function ChatPage() {
  const roomsResult:any=useChatRooms();
  const rooms=get(roomsResult,[])||[];
  const [active,setActive]=useState('');
  const [body,setBody]=useState('');
  const [search,setSearch]=useState('');
  const [editingId,setEditingId]=useState('');
  const [editBody,setEditBody]=useState('');
  const [issue,setIssue]=useState('');
  useEffect(()=>{if(!active&&rooms?.length)setActive(rooms[0].id)},[rooms,active]);
  const messagesResult:any=useChatMessages(active);
  const messages=get(messagesResult,[])||[];
  const visibleMessages=Array.isArray(messages)?messages.filter((m:any)=>!search.trim()||m.body?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())):[];
  useEffect(()=>{if(active)void run(markRoomRead,active).catch((e:any)=>setIssue(messageOf(e)))},[active]);
  const send=async(e:FormEvent)=>{e.preventDefault();if(!body.trim()||!active)return;setIssue('');try{await run(sendChatMessage,active,body.trim());setBody('');void queryClient.invalidateQueries({queryKey:['chat-messages',active]});void queryClient.invalidateQueries({queryKey:['chat-rooms']})}catch(err){setIssue(messageOf(err))}};
  const saveEdit=async(e:FormEvent)=>{e.preventDefault();try{await run(editChatMessage,editingId,editBody);setEditingId('');setEditBody('');void queryClient.invalidateQueries({queryKey:['chat-messages',active]})}catch(err){setIssue(messageOf(err))}};
  const remove=async(id:string)=>{if(!window.confirm('메시지를 삭제할까요?'))return;try{await run(deleteChatMessage,id);void queryClient.invalidateQueries({queryKey:['chat-messages',active]})}catch(err){setIssue(messageOf(err))}};
  const realtimeText=messagesResult.realtimeStatus==='connected'?'실시간 연결됨':messagesResult.realtimeStatus==='reconnecting'?'재연결 중':'연결 중';
  return <><SectionTitle eyebrow="SUPPORT CHAT" title="상담 채팅" description="상담 기록은 Supabase에 저장하고 새 메시지는 실시간으로 동기화합니다."/><div className="chat-layout"><Card className="room-panel"><div className="room-title"><span className="eyebrow">YOUR ROOMS</span><h2>상담 목록</h2></div><DataState result={roomsResult} empty={!pending(roomsResult)&&!rooms?.length} emptyText="참여 중인 상담방이 없습니다."><div className="room-list">{(Array.isArray(rooms)?rooms:[]).map((room:any)=><button key={room.id} className={cx('room-item',active===room.id&&'room-active')} onClick={()=>setActive(room.id)}><span className="room-icon"><MessageSquareText size={17}/></span><span><b>{room.title||'상담 채팅'}</b><small>{room.type||'지원 상담'} · {dateLabel(room.lastMessageAt)}</small></span><ChevronRight size={15}/></button>)}</div></DataState></Card><Card className="chat-panel"><div className="chat-head"><div><span className="eyebrow">LIVE SUPPORT</span><h2>{rooms.find((r:any)=>r.id===active)?.title||'대화를 선택해 주세요'}</h2></div>{active&&<span className={cx('chat-state',messagesResult.realtimeStatus==='connected'&&'chat-connected')}><i/>{realtimeText}</span>}</div>{!active?<div className="chat-empty"><div className="empty-icon"><MessageSquareText size={20}/></div><b>상담 채팅방을 선택해 주세요.</b><p>아직 상담이 없다면 문의 티켓을 작성해 주세요.</p><Link className="panel-link" href="/tickets">문의 티켓 열기 <ArrowRight size={14}/></Link></div>:<><div className="message-search"><Search size={15}/><input aria-label="메시지 검색" value={search} onChange={e=>setSearch(e.target.value)} placeholder="이 대화에서 메시지 검색"/></div><DataState result={messagesResult} empty={!pending(messagesResult)&&!visibleMessages?.length} emptyText={search?'검색 결과가 없습니다.':'아직 메시지가 없습니다. 첫 메시지를 남겨보세요.'}><div className="message-list">{visibleMessages.map((m:any)=><div className={cx('message-row',m.isOwn&&'message-own')} key={m.id}><div className="message-avatar">{(m.authorName||'?').slice(0,1).toUpperCase()}</div><div className="message-content"><div className="message-byline"><b>{m.authorName||'상담 참여자'}</b><time>{m.createdAt?new Date(m.createdAt).toLocaleString('ko-KR'):'—'}</time>{m.editedAt&&<small>수정됨</small>}</div>{editingId===m.id?<form className="message-edit" onSubmit={saveEdit}><input aria-label="메시지 수정" value={editBody} onChange={e=>setEditBody(e.target.value)} maxLength={10000}/><Button type="submit" variant="outline" disabled={!editBody.trim()}>저장</Button><button type="button" className="text-button" onClick={()=>setEditingId('')}>취소</button></form>:<p>{m.deletedAt?'삭제된 메시지입니다.':m.body}</p>}{m.isOwn&&!m.deletedAt&&editingId!==m.id&&<div className="chat-actions"><button className="text-button" onClick={()=>{setEditingId(m.id);setEditBody(m.body)}}><Pencil size={13}/> 수정</button><button className="text-button danger-text" onClick={()=>remove(m.id)}><Trash2 size={13}/> 삭제</button></div>}</div></div>)}</div></DataState>{issue&&<div className="inline-error message-error">{issue}</div>}<form className="chat-compose" onSubmit={send}><input aria-label="메시지 입력" value={body} onChange={e=>setBody(e.target.value)} placeholder="상담 메시지를 입력하세요…" maxLength={10000}/><Button type="submit" disabled={!body.trim()}>전송<ArrowRight size={15}/></Button></form></>}</Card></div></>;
}
function TicketsPage() {
  const result:any=useTickets(); const tickets=get(result,[])||[]; const [subject,setSubject]=useState(''); const [message,setMessage]=useState(''); const [issue,setIssue]=useState(''); const [success,setSuccess]=useState(''); const [busy,setBusy]=useState(false);
  const submit=async(e:FormEvent)=>{e.preventDefault();setIssue('');setSuccess('');if(!subject.trim()||!message.trim()){setIssue('제목과 문의 내용을 모두 입력해 주세요.');return}setBusy(true);try{await run(createTicket,subject.trim(),message.trim());setSubject('');setMessage('');setSuccess('문의가 접수되었습니다. 아래 문의 내역에서 상태를 확인할 수 있습니다.');void queryClient.invalidateQueries({queryKey:['tickets']});void queryClient.invalidateQueries({queryKey:['dashboard-summary']})}catch(err){setIssue(messageOf(err))}finally{setBusy(false)}};
  return <><SectionTitle eyebrow="SUPPORT REQUESTS" title="문의 티켓" description="새 문의를 접수하고 답변과 처리 상태를 확인합니다."/><div className="ticket-layout"><Card><div className="panel-head"><div><span className="eyebrow">NEW REQUEST</span><h2>문의 작성</h2></div><FileText size={18}/></div><form className="form-stack ticket-form" onSubmit={submit}><label htmlFor="ticket-subject">문의 제목</label><input id="ticket-subject" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="문의 내용을 간단히 적어 주세요" maxLength={120}/><label htmlFor="ticket-message">문의 내용</label><textarea id="ticket-message" className="textarea" value={message} onChange={e=>setMessage(e.target.value)} placeholder="확인이 필요한 내용을 자세히 적어 주세요." rows={6} maxLength={5000}/><div className="form-bottom"><small className="field-hint">{message.length}/5000</small><Button type="submit" disabled={busy}>{busy?'접수 중':'문의 접수'}<ArrowRight size={15}/></Button></div>{issue&&<NoticeBox kind="error">{issue}</NoticeBox>}{success&&<NoticeBox kind="success">{success}</NoticeBox>}</form></Card><Card className="ticket-side-note"><span className="eyebrow">HOW IT WORKS</span><div className="ticket-step"><b>01</b><span><strong>문의 접수</strong><small>내용을 확인하고 티켓을 생성합니다.</small></span></div><div className="ticket-step"><b>02</b><span><strong>담당자 확인</strong><small>상태 변경으로 진행 상황을 안내합니다.</small></span></div><div className="ticket-step"><b>03</b><span><strong>답변 확인</strong><small>완료된 요청은 내역에서 확인하세요.</small></span></div></Card></div><Card className="history-card"><div className="panel-head"><div><span className="eyebrow">TICKET HISTORY</span><h2>내 문의 내역</h2></div><span className="table-caption">{Array.isArray(tickets)?tickets.length:0}개 요청</span></div><DataState result={result} empty={!pending(result)&&!tickets?.length} emptyText="아직 문의 내역이 없습니다."><div className="table-wrap"><table><thead><tr><th>제목</th><th>상태</th><th>접수일</th><th>최근 업데이트</th></tr></thead><tbody>{(Array.isArray(tickets)?tickets:[]).map((t:any)=><tr key={t.id}><td><b>{t.subject}</b></td><td><Status value={t.status}/></td><td>{dateLabel(t.createdAt)}</td><td>{dateLabel(t.updatedAt)}</td></tr>)}</tbody></table></div></DataState></Card></>;
}
function SettingsPage() {
  const profileResult:any=useProfile(); const profile=get(profileResult)||{}; const [notifications,setNotifications]=useState(true); const [theme,setTheme]=useState<'light'|'dark'|'system'>(()=>{try{return (localStorage.getItem('tend-theme') as 'light'|'dark'|'system')||'light'}catch{return 'light'}}); const [issue,setIssue]=useState(''); const [saved,setSaved]=useState(false);
  useEffect(()=>{if(profile.theme==='light'||profile.theme==='dark'||profile.theme==='system')setTheme(profile.theme);if(profile.notificationPreferences&&typeof profile.notificationPreferences.general==='boolean')setNotifications(profile.notificationPreferences.general)},[profile.theme,profile.notificationPreferences?.general]);
  const save=async()=>{setIssue('');setSaved(false);try{await run(updateProfilePreferences,{notifications:{general:notifications},theme});try{localStorage.setItem('tend-theme',theme)}catch{}document.documentElement.classList.toggle('dark',theme==='dark');setSaved(true)}catch(e){setIssue(messageOf(e))}};
  return <><SectionTitle eyebrow="PREFERENCES" title="설정" description="계정 프로필과 알림, 화면 표시 방식을 관리합니다."/><div className="settings-page-grid"><Card><div className="panel-head"><div><span className="eyebrow">PROFILE</span><h2>Discord 프로필</h2></div></div>{pending(profileResult)?<Loading/>:problem(profileResult)?<NoticeBox kind="error">{messageOf(problem(profileResult))}</NoticeBox>:<div className="settings-profile"><div className="profile-large">{(profile.displayName||profile.username||'T').slice(0,1)}</div><div><b>{profile.displayName||profile.username||'Discord 계정'}</b><small>{profile.username?`@${profile.username}`:'프로필 이름 미설정'}</small></div><Status value={profile.accountStatus}/><div className="profile-details"><span>Discord ID <b className="mono">{profile.discordId||'—'}</b></span><span>계정 생성 <b>{dateLabel(profile.createdAt)}</b></span><span>최근 로그인 <b>{dateLabel(profile.lastLoginAt)}</b></span></div></div>}</Card><Card><div className="panel-head"><div><span className="eyebrow">PREFERENCES</span><h2>알림 및 화면</h2></div><Settings size={18}/></div><div className="preference-row"><span><b>서비스 알림</b><small>티켓과 서버 상태 관련 알림을 받습니다.</small></span><button role="switch" aria-checked={notifications} className={cx('switch',notifications&&'switch-on')} onClick={()=>setNotifications(v=>!v)}><span/></button></div><div className="preference-row"><span><b>화면 테마</b><small>기본은 밝은 화면입니다. 원하는 모드를 선택하세요.</small></span><div className="theme-select"><button className={theme==='light'?'theme-selected':''} onClick={()=>setTheme('light')}><Sun size={15}/>라이트</button><button className={theme==='dark'?'theme-selected':''} onClick={()=>setTheme('dark')}><Moon size={15}/>다크</button></div></div>{issue&&<NoticeBox kind="error">{issue}</NoticeBox>}{saved&&<div className="save-success"><Check size={15}/> 설정이 저장되었습니다.</div>}<div className="settings-save"><Button onClick={save}>변경 사항 저장<Check size={15}/></Button></div></Card></div><Card className="account-status-card"><div className="account-status-icon"><ShieldCheck size={19}/></div><div><b>Discord 연동 계정</b><p>계정 연결과 이용 상태는 인증된 Discord 프로필을 기준으로 관리됩니다.</p></div><Status value={profile.accountStatus}/></Card></>;
}
function OwnerPage() {
  const access:any=useOwnerAccess(); const result:any=useOwnerSummary(); const summary=get(result)||{}; const [issue,setIssue]=useState(''); const [busy,setBusy]=useState(false);
  const ownerData=get(access);
  const allowed=ownerData===true||!!(ownerData?.allowed||ownerData?.isOwner||ownerData?.verified);
  const bootstrap=async()=>{setIssue('');setBusy(true);try{await run(runOwnerBootstrap);await access.refetch();await queryClient.invalidateQueries({queryKey:['owner-summary']})}catch(e){setIssue(messageOf(e))}finally{setBusy(false)}};
  if(pending(access))return <><SectionTitle eyebrow="RESTRICTED" title="운영자 도구" description="검증된 운영자만 사용할 수 있습니다."/><Loading label="운영자 권한을 확인하고 있습니다"/></>;
  if(problem(access))return <><SectionTitle eyebrow="RESTRICTED" title="운영자 도구"/><NoticeBox kind="error">권한 확인에 실패했습니다. {messageOf(problem(access))}</NoticeBox></>;
  if(!allowed)return <><div className="denied"><div className="denied-mark"><Shield size={24}/></div><span className="eyebrow">OWNER ACCESS ONLY</span><h1>접근 권한이 없습니다</h1><p>운영자 도구와 관련 데이터는 서버에서 소유자 권한이 확인된 계정에만 제공됩니다.</p><Button href="/dashboard" variant="outline"><ArrowLeft size={15}/>대시보드로 이동</Button></div><Card className="bootstrap-card"><div><span className="eyebrow">FIRST-TIME OWNER SETUP</span><h2>소유자 계정 확인</h2><p>초기 설정은 Supabase Edge Function이 설정된 숫자 Discord 사용자 ID와 로그인 계정을 대조합니다. 일반 계정은 권한을 받을 수 없습니다.</p>{issue&&<NoticeBox kind="error">{issue}</NoticeBox>}</div><Button onClick={bootstrap} disabled={busy} variant="outline">{busy?'확인 중':'소유자 확인 실행'}<ArrowRight size={15}/></Button></Card></>;
  const metrics=[
    {label:'전체 사용자',value:summary.userCount,icon:Activity},
    {label:'오늘 로그인',value:summary.todayLoginCount,icon:Activity},
    {label:'등록 서버',value:summary.serverCount,icon:Server},
    {label:'관리 중 서버',value:summary.managedServerCount,icon:Server},
    {label:'활성 패스',value:summary.activePassCount,icon:ShieldCheck},
    {label:'만료 예정 패스',value:summary.expiringPassCount,icon:ShieldCheck},
    {label:'결제 확인 대기',value:summary.pendingPaymentCount,icon:Ticket},
    {label:'처리 대기 티켓',value:summary.openTicketCount,icon:Ticket},
  ];
  return <><SectionTitle eyebrow="OWNER OPERATIONS" title="운영자 도구" description="서버에서 검증된 소유자 권한으로 서비스 현황과 요청을 관리합니다."/><NoticeBox><ShieldCheck size={17}/> 서버에서 소유자 권한이 확인되었습니다.</NoticeBox>{problem(result)&&<NoticeBox kind="error">{messageOf(problem(result))}</NoticeBox>}{pending(result)?<Loading/>:<div className="metric-grid owner-metrics">{metrics.map(({label,value,icon:Icon})=><Card key={label} className="owner-metric"><span>{label}</span><Icon size={17}/><strong>{value??'—'}</strong></Card>)}</div>}<OwnerConsole/></>;
}

function OwnerConsole() {
  const tabs=[
    ['users','사용자'],['servers','서버'],['payments','결제·이용권'],
    ['tickets','문의 티켓'],['products','상품 설정'],['maintenance','서비스 설정'],['audit','감사 로그'],
  ] as const;
  const [tab,setTab]=useState<(typeof tabs)[number][0]>('users');
  const [searchInput,setSearchInput]=useState('');
  const [searchTerm,setSearchTerm]=useState('');
  const [selectedTicketId,setSelectedTicketId]=useState('');
  const [reply,setReply]=useState('');
  const [issue,setIssue]=useState('');
  const [busy,setBusy]=useState(false);
  const [productId,setProductId]=useState('');
  const [productName,setProductName]=useState('');
  const [productDays,setProductDays]=useState('1');
  const [productPrice,setProductPrice]=useState('');
  const [productActive,setProductActive]=useState(true);
  const [maintenanceEnabled,setMaintenanceEnabled]=useState(false);
  const [maintenanceMessage,setMaintenanceMessage]=useState('');

  const usersResult:any=useOwnerUsers(searchTerm);
  const serversResult:any=useOwnerServers();
  const paymentsResult:any=useOwnerPayments();
  const productsResult:any=useOwnerProducts();
  const ticketsResult:any=useOwnerTickets();
  const auditResult:any=useOwnerAudit();
  const maintenanceResult:any=useOwnerMaintenance();
  const ticketRows=get(ticketsResult)?.tickets||[];
  const ticketMessagesResult:any=useOwnerTicketMessages(selectedTicketId);
  const staffUsers=(get(usersResult)?.users||[]).filter((user:any)=>user.role==='staff'||user.role==='owner');

  useEffect(()=>{
    if(Array.isArray(ticketRows)&&ticketRows.length&&!ticketRows.some((ticket:any)=>ticket.id===selectedTicketId)){
      setSelectedTicketId(ticketRows[0].id);
    }
  },[ticketRows,selectedTicketId]);
  useEffect(()=>{
    const settings=get(maintenanceResult);
    if(settings){setMaintenanceEnabled(settings.enabled);setMaintenanceMessage(settings.message||'')}
  },[maintenanceResult?.data]);

  const refresh=async()=>{
    const keys=['owner-users','owner-servers','owner-payments','owner-products','owner-tickets','owner-audit','owner-maintenance','owner-summary','servers','passes','pass-products','tickets','dashboard-summary'];
    await Promise.all(keys.map(key=>queryClient.invalidateQueries({queryKey:[key]})));
  };
  const act=async(action:string,payload:Record<string,unknown>={})=>{
    setIssue('');setBusy(true);
    try{await ownerAdmin(action,payload);await refresh()}
    catch(error){setIssue(messageOf(error))}
    finally{setBusy(false)}
  };
  const setStatus=async(user:any)=>{
    const status=user.account_status==='restricted'?'active':'restricted';
    if(status==='restricted'&&!window.confirm('이 사용자 계정을 제한할까요?'))return;
    await act('set_account_status',{userId:user.id,status});
  };
  const toggleStaff=async(user:any)=>{
    const enabled=user.role!=='staff';
    if(!window.confirm(enabled?'이 사용자에게 운영진 권한을 부여할까요?':'운영진 권한을 회수할까요?'))return;
    await act('set_staff_role',{userId:user.id,enabled});
  };
  const setServerState=async(server:any)=>{
    const status=server.status==='active'?'paused':'active';
    if(!window.confirm(status==='active'?'봇 연결, 유효한 이용권, 검증된 관리 권한을 확인한 뒤 서버 관리를 시작합니다. 진행할까요?':'이 서버 관리를 일시 중지할까요?'))return;
    await act('set_server_state',{serverId:server.id,status});
  };
  const reviewPayment=async(payment:any,status:'paid'|'rejected'|'refunded')=>{
    const label=status==='paid'?'결제를 확인하고 이용권 기간을 시작':status==='rejected'?'결제를 거절':'환불 처리 상태를 기록';
    if(!window.confirm(`${label}할까요?`))return;
    await act('review_payment',{paymentId:payment.id,status});
  };
  const saveProduct=async(event:FormEvent)=>{
    event.preventDefault();
    const price=Number(productPrice);
    if(!productName.trim()||!Number.isFinite(price)||price<0){setIssue('상품명과 0 이상의 가격을 입력해 주세요.');return}
    await act('set_product',{productId:productId||undefined,name:productName.trim(),durationDays:Number(productDays),price,active:productActive});
    setProductId('');setProductName('');setProductPrice('');setProductDays('1');setProductActive(true);
  };
  const editProduct=(product:any)=>{
    setProductId(product.id);setProductName(product.name);setProductDays(String(product.duration_days));setProductPrice(String(product.price));setProductActive(product.active);
  };
  const sendReply=async(event:FormEvent)=>{
    event.preventDefault();if(!selectedTicketId||!reply.trim())return;
    await act('reply_ticket',{ticketId:selectedTicketId,body:reply.trim()});
    setReply('');
    void queryClient.invalidateQueries({queryKey:['owner-ticket-messages',selectedTicketId]});
  };
  const updateTicket=async(ticket:any,changes:Record<string,unknown>)=>{
    await act('set_ticket',{ticketId:ticket.id,status:ticket.status,assigneeId:ticket.assignee_id||null,...changes});
  };

  return <section className="owner-console">
    <div className="owner-tab-list" role="tablist" aria-label="운영자 기능">
      {tabs.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={cx('owner-tab',tab===id&&'owner-tab-active')} onClick={()=>setTab(id)}>{label}</button>)}
    </div>
    {issue&&<NoticeBox kind="error">{issue}</NoticeBox>}
    {tab==='users'&&<Card><div className="panel-head"><div><span className="eyebrow">ACCOUNT ADMINISTRATION</span><h2>사용자 관리</h2></div><span className="table-caption">계정 상태와 운영진 권한</span></div><form className="owner-search" onSubmit={event=>{event.preventDefault();setSearchTerm(searchInput.trim())}}><input value={searchInput} onChange={event=>setSearchInput(event.target.value)} placeholder="Discord 사용자명 또는 숫자 ID" aria-label="사용자 검색"/><Button type="submit" variant="outline"><Search size={15}/>검색</Button></form><DataState result={usersResult} empty={!pending(usersResult)&&!(get(usersResult)?.users||[]).length} emptyText="검색 결과가 없습니다."><div className="table-wrap"><table><thead><tr><th>사용자</th><th>Discord ID</th><th>역할</th><th>계정 상태</th><th>관리</th></tr></thead><tbody>{(get(usersResult)?.users||[]).map((user:any)=><tr key={user.id}><td><b>{user.display_name||user.username||'이름 없음'}</b><small className="table-sub">{user.username?`@${user.username}`:''}</small></td><td className="mono">{user.discord_id||'—'}</td><td><Status value={user.role}/></td><td><Status value={user.account_status}/></td><td className="owner-actions"><Button variant="outline" disabled={busy||user.role==='owner'} onClick={()=>toggleStaff(user)}>{user.role==='staff'?'운영진 해제':'운영진 지정'}</Button><Button variant="outline" disabled={busy||user.role==='owner'} onClick={()=>setStatus(user)}>{user.account_status==='restricted'?'제한 해제':'계정 제한'}</Button></td></tr>)}</tbody></table></div></DataState></Card>}
    {tab==='servers'&&<Card><div className="panel-head"><div><span className="eyebrow">SERVER ADMINISTRATION</span><h2>서버 관리</h2></div></div><DataState result={serversResult} empty={!pending(serversResult)&&!(get(serversResult)?.servers||[]).length} emptyText="등록된 서버가 없습니다."><div className="table-wrap"><table><thead><tr><th>서버 ID</th><th>서버명</th><th>봇 상태</th><th>관리 상태</th><th>요청자</th><th>작업</th></tr></thead><tbody>{(get(serversResult)?.servers||[]).map((server:any)=><tr key={server.id}><td className="mono">{server.discord_server_id}</td><td>{server.name||'서버 이름 미확인'}</td><td><Status value={server.bot_status}/></td><td><Status value={server.status}/></td><td className="mono">{server.created_by}</td><td><Button variant="outline" disabled={busy||!['active','requested','paused'].includes(server.status)} onClick={()=>setServerState(server)}>{server.status==='active'?'일시 중지':'관리 시작'}</Button></td></tr>)}</tbody></table></div></DataState><p className="owner-note">관리 시작은 봇 온라인, 유효한 결제 이용권, 검증된 서버 관리자 권한이 모두 확인될 때만 승인됩니다.</p></Card>}
    {tab==='payments'&&<Card><div className="panel-head"><div><span className="eyebrow">MANUAL PAYMENT REVIEW</span><h2>결제 및 이용권</h2></div><span className="table-caption">실제 결제 처리가 아닌 수동 확인 기록</span></div><DataState result={paymentsResult} empty={!pending(paymentsResult)&&!(get(paymentsResult)?.payments||[]).length} emptyText="결제 내역이 없습니다."><div className="table-wrap"><table><thead><tr><th>요청</th><th>상품</th><th>서버</th><th>금액</th><th>상태</th><th>처리</th></tr></thead><tbody>{(get(paymentsResult)?.payments||[]).map((payment:any)=><tr key={payment.id}><td>{dateLabel(payment.created_at)}<small className="table-sub mono">{payment.requester_id}</small></td><td>{payment.pass?.product?.name||`${payment.pass?.product?.duration_days||'?'}일 이용권`}</td><td className="mono">{payment.pass?.server?.discord_server_id||'—'}</td><td>{Number(payment.amount).toLocaleString('ko-KR')}원</td><td><Status value={payment.status}/></td><td className="owner-actions">{payment.status==='pending'?<><Button variant="outline" disabled={busy} onClick={()=>reviewPayment(payment,'paid')}>결제 확인</Button><Button variant="outline" disabled={busy} onClick={()=>reviewPayment(payment,'rejected')}>거절</Button></>:payment.status==='paid'?<Button variant="outline" disabled={busy} onClick={()=>reviewPayment(payment,'refunded')}>환불 기록</Button>:<span>기록됨</span>}</td></tr>)}</tbody></table></div></DataState></Card>}
    {tab==='products'&&<div className="owner-stack"><Card><div className="panel-head"><div><span className="eyebrow">PASS CATALOG</span><h2>{productId?'상품 수정':'이용권 상품 추가'}</h2></div></div><form className="owner-product-form" onSubmit={saveProduct}><label>상품명<input value={productName} onChange={e=>setProductName(e.target.value)} maxLength={120} required/></label><label>이용 기간<select value={productDays} onChange={e=>setProductDays(e.target.value)}><option value="1">1일</option><option value="10">10일</option><option value="30">30일</option></select></label><label>가격 (원)<input type="number" min="0" step="1" value={productPrice} onChange={e=>setProductPrice(e.target.value)} required/></label><label className="owner-inline-check"><input type="checkbox" checked={productActive} onChange={e=>setProductActive(e.target.checked)}/>판매 활성화</label><div className="owner-form-actions"><Button type="submit" disabled={busy}>{productId?'상품 저장':'상품 추가'}</Button>{productId&&<Button type="button" variant="outline" onClick={()=>{setProductId('');setProductName('');setProductPrice('')}}>취소</Button>}</div></form></Card><Card><div className="panel-head"><div><span className="eyebrow">CURRENT PRODUCTS</span><h2>상품 목록</h2></div></div><DataState result={productsResult} empty={!pending(productsResult)&&!(get(productsResult)?.products||[]).length} emptyText="등록된 상품이 없습니다."><div className="table-wrap"><table><thead><tr><th>상품</th><th>기간</th><th>가격</th><th>상태</th><th>관리</th></tr></thead><tbody>{(get(productsResult)?.products||[]).map((product:any)=><tr key={product.id}><td>{product.name}</td><td>{product.duration_days}일</td><td>{Number(product.price).toLocaleString('ko-KR')}원</td><td><Status value={product.active?'active':'paused'}/></td><td className="owner-actions"><Button variant="outline" onClick={()=>editProduct(product)}>수정</Button><Button variant="outline" disabled={busy} onClick={()=>void act('set_product',{productId:product.id,name:product.name,durationDays:product.duration_days,price:Number(product.price),active:!product.active})}>{product.active?'비활성화':'활성화'}</Button></td></tr>)}</tbody></table></div></DataState></Card></div>}
    {tab==='tickets'&&<div className="owner-ticket-layout"><Card><div className="panel-head"><div><span className="eyebrow">SUPPORT QUEUE</span><h2>문의 티켓</h2></div></div><DataState result={ticketsResult} empty={!pending(ticketsResult)&&!ticketRows.length} emptyText="처리할 티켓이 없습니다."><div className="owner-ticket-list">{ticketRows.map((ticket:any)=><button key={ticket.id} className={cx('owner-ticket-item',selectedTicketId===ticket.id&&'owner-ticket-selected')} onClick={()=>setSelectedTicketId(ticket.id)}><b>{ticket.subject}</b><small>{ticket.requester?.display_name||ticket.requester?.username||ticket.requester_id}</small><Status value={ticket.status}/></button>)}</div></DataState></Card><Card className="owner-ticket-detail"><div className="panel-head"><div><span className="eyebrow">TICKET DETAIL</span><h2>{ticketRows.find((t:any)=>t.id===selectedTicketId)?.subject||'티켓을 선택하세요'}</h2></div></div>{selectedTicketId&&(()=>{const ticket=ticketRows.find((t:any)=>t.id===selectedTicketId);return ticket?<><div className="owner-ticket-controls"><label>상태<select value={ticket.status} onChange={event=>void updateTicket(ticket,{status:event.target.value})}><option value="open">접수</option><option value="in_progress">처리 중</option><option value="resolved">답변 완료</option><option value="closed">종료</option></select></label><label>담당자<select value={ticket.assignee_id||''} onChange={event=>void updateTicket(ticket,{assigneeId:event.target.value||null})}><option value="">미지정</option>{staffUsers.map((user:any)=><option key={user.id} value={user.id}>{user.display_name||user.username||user.id}</option>)}</select></label></div><DataState result={ticketMessagesResult} empty={!pending(ticketMessagesResult)&&!(get(ticketMessagesResult)?.messages||[]).length} emptyText="아직 대화 메시지가 없습니다."><div className="owner-messages">{(get(ticketMessagesResult)?.messages||[]).map((message:any)=><article key={message.id}><b>{message.author?.display_name||message.author?.username||'상담 참여자'}</b><time>{new Date(message.created_at).toLocaleString('ko-KR')}</time><p>{message.deleted_at?'삭제된 메시지입니다.':message.body}</p></article>)}</div></DataState><form className="owner-reply" onSubmit={sendReply}><textarea value={reply} onChange={event=>setReply(event.target.value)} maxLength={10000} rows={3} placeholder="답변 작성" required/><Button type="submit" disabled={busy||!reply.trim()}>답변 보내기<ArrowRight size={15}/></Button></form></>:null})()}</Card></div>}
    {tab==='maintenance'&&<Card><div className="panel-head"><div><span className="eyebrow">SERVICE SETTINGS</span><h2>점검 안내</h2></div></div><DataState result={maintenanceResult}><div className="maintenance-form"><label className="owner-inline-check"><input type="checkbox" checked={maintenanceEnabled} onChange={event=>setMaintenanceEnabled(event.target.checked)}/>점검 모드 활성화</label><label>사용자 안내 문구<textarea value={maintenanceMessage} onChange={event=>setMaintenanceMessage(event.target.value)} maxLength={1000} rows={4}/></label><Button disabled={busy} onClick={()=>void act('set_maintenance',{enabled:maintenanceEnabled,message:maintenanceMessage})}>서비스 설정 저장<Check size={15}/></Button></div></DataState></Card>}
    {tab==='audit'&&<Card><div className="panel-head"><div><span className="eyebrow">IMMUTABLE OPERATIONS</span><h2>감사 로그</h2></div><span className="table-caption">최근 100건</span></div><DataState result={auditResult} empty={!pending(auditResult)&&!(get(auditResult)?.logs||[]).length} emptyText="감사 로그가 없습니다."><div className="table-wrap"><table><thead><tr><th>시각</th><th>작업</th><th>대상</th><th>결과</th></tr></thead><tbody>{(get(auditResult)?.logs||[]).map((log:any)=><tr key={log.id}><td>{new Date(log.created_at).toLocaleString('ko-KR')}</td><td className="mono">{log.action}</td><td>{log.target_type||'—'} · {log.target_id||'—'}</td><td><Status value={log.result}/></td></tr>)}</tbody></table></div></DataState></Card>}
  </section>;
}
function Protected({ component:Component }: {component:()=>any}) { return <AuthGate><Component/></AuthGate>; }
function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={PublicPage}/><Route path="/login" component={LoginPage}/>
    <Route path="/dashboard"><Protected component={Dashboard}/></Route>
    <Route path="/servers"><Protected component={ServersPage}/></Route>
    <Route path="/servers/:id/settings"><Protected component={ServerSettingsPage}/></Route>
    <Route path="/passes"><Protected component={PassesPage}/></Route>
    <Route path="/chat"><Protected component={ChatPage}/></Route>
    <Route path="/tickets"><Protected component={TicketsPage}/></Route>
    <Route path="/settings"><Protected component={SettingsPage}/></Route>
    <Route path="/owner"><Protected component={OwnerPage}/></Route>
    <Route component={NotFound}/>
  </Switch></RoutedErrorBoundary>;
}
function RoutedErrorBoundary({children}:{children:ReactNode}) {
  const [location]=useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><Router/></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>;
}
export default App;

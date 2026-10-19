import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, Router as WouterRouter, useRoute } from 'wouter';
import {
  useHealthCheck, useListDocuments, getListDocumentsQueryKey, useCreateDocument,
  useRequestDocumentUpload, useGetDocument, getGetDocumentQueryKey, useUpdateDocument,
  useDeleteDocument, useListAnnouncements, getListAnnouncementsQueryKey,
  useCreateAnnouncement, useUpdateAnnouncement, useDeleteAnnouncement, useTeacherLogin,
  useGetTeacherSession, getGetTeacherSessionQueryKey, useTeacherLogout,
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  type Document as AcademicDocument, type Announcement, type AnnouncementCategory,
} from '@workspace/api-client-react';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays, Check,
  Clock3, FileImage, FileText, Filter, GraduationCap, LockKeyhole,
  LogOut, MapPin, Menu, Search, ShieldCheck, UploadCloud, X, Plus, Pencil, Trash2,
  CircleAlert, RefreshCw, BookMarked, CalendarClock, MessageCircle,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();
const categories: { value: AnnouncementCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Tout voir' },
  { value: 'announcement', label: 'Annonces' },
  { value: 'homework', label: 'Devoirs' },
  { value: 'exam', label: 'Examens' },
  { value: 'schedule', label: 'Emploi du temps' },
  { value: 'schedule_change', label: 'Changements' },
];
const categoryLabel: Record<AnnouncementCategory, string> = {
  announcement: 'Annonce', homework: 'Devoir', exam: 'Examen',
  schedule: 'Emploi du temps', schedule_change: 'Changement',
};
const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function formatDate(value?: string | null) {
  if (!value) return '';
  const calendarDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = new Date(calendarDate ? `${value}T00:00:00Z` : value);
  return Number.isNaN(d.valueOf()) ? value : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', ...(calendarDate ? { timeZone: 'UTC' } : {}) }).format(d);
}
function shortDate(value?: string | null) {
  if (!value) return { day: '—', month: '' };
  const calendarDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = new Date(calendarDate ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.valueOf())) return { day: value, month: '' };
  return { day: new Intl.DateTimeFormat('fr-FR', { day: '2-digit', ...(calendarDate ? { timeZone: 'UTC' } : {}) }).format(d), month: new Intl.DateTimeFormat('fr-FR', { month: 'short', ...(calendarDate ? { timeZone: 'UTC' } : {}) }).format(d).replace('.', '') };
}
function sizeLabel(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(size / 1024))} Ko`;
}
function errorText(err: unknown, fallback = 'Une erreur est survenue. Veuillez réessayer.') {
  return err instanceof Error ? err.message : fallback;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: health } = useHealthCheck();
  const nav = [
    { href: '/', label: 'Documents', icon: BookOpen },
    { href: '/annonces', label: 'Annonces & agenda', icon: CalendarDays },
    { href: '/enseignant', label: 'Espace enseignant', icon: LockKeyhole },
  ];
  return <div className="site-shell">
    <header className="topbar">
      <Link href="/" className="brand" aria-label="FASEG DOCS, accueil" data-testid="link-brand">
        <span className="brand-emblem"><BookMarked size={20} strokeWidth={1.8} /></span>
        <span className="brand-words"><strong>FASEG<span> DOCS</span></strong><small>Université de Parakou</small></span>
      </Link>
      <button className="mobile-menu icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} data-testid="button-menu"><Menu size={21} /></button>
      <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Navigation principale">
        {nav.map(item => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`nav-link ${location === item.href || (item.href === '/' && location.startsWith('/documents/')) ? 'active' : ''}`} data-testid={`link-nav-${item.href === '/' ? 'documents' : item.href.slice(1)}`}><item.icon size={17} />{item.label}</Link>)}
      </nav>
      <div className="topbar-right"><span className={`api-status ${health?.status === 'ok' ? 'online' : ''}`}><i /> Service {health?.status === 'ok' ? 'opérationnel' : 'universitaire'}</span><span className="topbar-divider" /><span className="school-mark">Parakou <b>•</b> Bénin</span></div>
    </header>
    <main>{children}</main>
    <footer className="footer"><div className="footer-inner"><span className="footer-brand">FASEG DOCS</span><span>Ressources académiques · Faculté des Sciences Économiques et de Gestion</span><span className="footer-country">Parakou, Bénin</span></div></footer>
  </div>;
}

function PageIntro({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow"><span />{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{children}</div>;
}
function AlertBox({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="alert-box" role="alert"><CircleAlert size={19} /><span>{message}</span>{retry && <button className="text-button" onClick={retry}><RefreshCw size={14} /> Réessayer</button>}</div>;
}
function LoadingRows() {
  return <div className="skeleton-list" aria-label="Chargement des ressources">{[0, 1, 2, 3].map(x => <div className="skeleton-row" key={x}><div className="skeleton-icon" /><div className="skeleton-copy"><i /><i /></div><i className="skeleton-meta" /></div>)}</div>;
}
function FileGlyph({ type }: { type: string }) {
  const image = type.startsWith('image/');
  return <span className={`file-glyph ${image ? 'image-glyph' : ''}`}>{image ? <FileImage size={20} /> : <FileText size={20} />}<small>{image ? 'IMG' : 'PDF'}</small></span>;
}
function WhatsAppShare({ message, className = '' }: { message: string; className?: string }) {
  const pageUrl = typeof window === 'undefined' ? '' : window.location.href;
  const text = `${message}\n${pageUrl}`;
  return <a className={`whatsapp-share ${className}`} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" aria-label={`Partager sur WhatsApp : ${message}`} data-testid="link-share-whatsapp"><MessageCircle size={16} /><span>Partager sur WhatsApp</span></a>;
}

function HomePage() {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');
  const [semester, setSemester] = useState('');
  const params = useMemo(() => ({ search: search.trim() || undefined, subject: subject || undefined, level: level || undefined, semester: semester || undefined }), [search, subject, level, semester]);
  const docs = useListDocuments(params);
  const announcements = useListAnnouncements();
  const featured = (announcements.data ?? []).filter(a => a.eventDate).slice(0, 2);
  const clearFilters = () => { setSearch(''); setSubject(''); setLevel(''); setSemester(''); };
  const hasFilters = Boolean(search || subject || level || semester);
  return <div className="content-wrap library-page">
    <section className="welcome-band">
      <div className="welcome-content"><div className="eyebrow light"><span />LE SAVOIR À PORTÉE DE MAIN</div><h1>Votre réussite<br /><em>commence ici.</em></h1><p>Retrouvez les supports de cours et les informations essentielles de la FASEG, réunis au même endroit.</p><div className="welcome-bottom"><span><ShieldCheck size={17} /> Ressources vérifiées par vos enseignants</span><span className="welcome-code">N° 01 <i>—</i> FASEG</span></div></div>
      <div className="welcome-art" aria-hidden="true"><div className="art-arc arc-one" /><div className="art-arc arc-two" /><div className="art-orb" /><div className="art-line" /><span className="art-caption">ÉTUDIER · COMPRENDRE · RÉUSSIR</span><span className="art-number">01</span></div>
    </section>
    <PageIntro eyebrow="BIBLIOTHÈQUE UNIVERSITAIRE" title="Les documents de cours" description="Des supports fiables, classés par matière et niveau, pour accompagner chaque étape de votre parcours.">
      <span className="resource-stamp"><BookOpen size={17} /> Supports de cours</span>
    </PageIntro>
    <section className="library-search" aria-label="Rechercher dans les documents">
      <label className="search-field"><Search size={19} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un cours, une matière…" aria-label="Rechercher un document" data-testid="input-search-documents" />{search && <button aria-label="Effacer la recherche" onClick={() => setSearch('')}><X size={16} /></button>}</label>
      <div className="filters"><span className="filter-label"><Filter size={14} /> FILTRER</span>
        <select value={subject} onChange={e => setSubject(e.target.value)} aria-label="Filtrer par matière" data-testid="select-subject"><option value="">Toutes les matières</option>{[...new Set((docs.data ?? []).map(d => d.subject))].sort().map(s => <option key={s}>{s}</option>)}</select>
        <select value={level} onChange={e => setLevel(e.target.value)} aria-label="Filtrer par niveau" data-testid="select-level"><option value="">Tous les niveaux</option>{[...new Set((docs.data ?? []).map(d => d.level))].sort().map(s => <option key={s}>{s}</option>)}</select>
        <select value={semester} onChange={e => setSemester(e.target.value)} aria-label="Filtrer par semestre" data-testid="select-semester"><option value="">Tous les semestres</option>{[...new Set((docs.data ?? []).map(d => d.semester))].sort().map(s => <option key={s}>{s}</option>)}</select>
      </div>
    </section>
    <div className="section-heading"><div><span className="section-kicker">RESSOURCES DISPONIBLES</span><h2>{hasFilters ? 'Résultats de recherche' : 'Derniers documents'}</h2></div>{docs.data && <span className="result-count">{docs.data.length} document{docs.data.length !== 1 ? 's' : ''}</span>}</div>
    {docs.isLoading ? <LoadingRows /> : docs.error ? <AlertBox message={`Impossible de charger les documents. ${errorText(docs.error)}`} retry={() => docs.refetch()} /> : (docs.data ?? []).length === 0 ?
      <div className="empty-panel"><div className="empty-mark"><Search size={23} /></div><h3>{hasFilters ? 'Aucun résultat pour cette recherche' : 'La bibliothèque se prépare'}</h3><p>{hasFilters ? 'Essayez d’autres mots-clés ou retirez certains filtres.' : 'Les supports de cours publiés apparaîtront ici.'}</p>{hasFilters && <button className="button button-outline" onClick={clearFilters}>Effacer les filtres</button>}</div> :
       <div className="document-list">{(docs.data ?? []).map((doc, i) => <DocumentRow doc={doc} key={doc.id} index={i} />)}</div>}
    <section className="announcement-strip"><div className="strip-head"><div><span className="section-kicker">À NE PAS MANQUER</span><h2>Les prochaines échéances</h2></div><Link href="/annonces" className="strip-link">Toutes les annonces <ArrowRight size={15} /></Link></div>
      {announcements.isLoading ? <div className="mini-loading">Chargement de l’agenda…</div> : announcements.error ? <p className="muted-note">L’agenda est momentanément indisponible.</p> : featured.length === 0 ? <div className="strip-empty"><CalendarClock size={18} /><span>Aucune échéance annoncée pour le moment.</span></div> :
      <div className="featured-events">{featured.map(event => <EventCard key={event.id} event={event} compact />)}</div>}
    </section>
    <section className="trust-note"><ShieldCheck size={18} /><span>Chaque document est publié depuis l’espace sécurisé des enseignants.</span><Link href="/enseignant">En savoir plus <ArrowRight size={14} /></Link></section>
  </div>;
}

function DocumentRow({ doc, index }: { doc: AcademicDocument; index: number }) {
  return <Link href={`/documents/${doc.id}`} className="document-row" data-testid={`link-document-${doc.id}`}><FileGlyph type={doc.contentType} /><div className="document-main"><span className="document-subject">{doc.subject}</span><h3>{doc.title}</h3><p>{doc.description || `${doc.level} · ${doc.semester}`}</p></div><div className="document-tags"><span>{doc.level}</span><span>{doc.semester}</span></div><div className="document-meta"><span>{sizeLabel(doc.fileSize)}</span><span>{formatDate(doc.createdAt)}</span></div><span className="row-arrow"><ArrowRight size={17} /></span><span className="row-index">{String(index + 1).padStart(2, '0')}</span></Link>;
}

function EventCard({ event, compact = false }: { event: Announcement; compact?: boolean }) {
  const date = shortDate(event.eventDate);
  return <article className={`event-card ${compact ? 'compact-event' : ''}`} data-testid={`card-announcement-${event.id}`}><div className="event-date"><b>{date.day}</b><span>{date.month}</span></div><div className="event-info"><div className="event-label-row"><span className={`category-pill category-${event.category}`}>{categoryLabel[event.category]}</span>{event.subject && <span className="event-subject">{event.subject}</span>}</div><h3>{event.title}</h3><p>{event.content}</p><div className="event-details">{event.eventDate && <span><CalendarDays size={14} />{formatDate(event.eventDate)}</span>}{event.startTime && <span><Clock3 size={14} />{event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}</span>}{event.location && <span><MapPin size={14} />{event.location}</span>}{event.level && <span><GraduationCap size={14} />{event.level}</span>}</div><WhatsAppShare message={`Information FASEG — ${event.title}`} /></div></article>;
}

function AnnouncementsPage() {
  const [category, setCategory] = useState<AnnouncementCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const params = useMemo(() => ({ category: category === 'all' ? undefined : category, search: search.trim() || undefined }), [category, search]);
  const announcements = useListAnnouncements(params);
  return <div className="content-wrap announcements-page">
    <div className="announcement-hero"><div className="eyebrow light"><span />LE FIL DE LA FACULTÉ</div><h1>La vie de la FASEG,<br /><em>en temps réel.</em></h1><p>Informations, devoirs, examens et changements de programme. Restez au courant, sans rien manquer.</p><div className="hero-rule"><span /> INFORMATION ACADÉMIQUE <i>•</i> PARAKOU, BÉNIN</div><CalendarDays className="announcement-hero-icon" size={138} strokeWidth={0.7} /></div>
    <PageIntro eyebrow="INFORMATIONS & AGENDA" title="Annonces et échéances" description="Les actualités de vos cours et les dates importantes, publiées par vos enseignants." />
    <div className="announcement-tools"><label className="search-field compact-search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une annonce…" aria-label="Rechercher une annonce" data-testid="input-search-announcements" /></label><div className="category-tabs" role="tablist" aria-label="Filtrer par catégorie">{categories.map(c => <button key={c.value} role="tab" aria-selected={category === c.value} className={`category-tab ${category === c.value ? 'selected' : ''}`} onClick={() => setCategory(c.value)} data-testid={`tab-category-${c.value}`}>{c.label}</button>)}</div></div>
     <div className="announcements-list">{announcements.isLoading ? <LoadingRows /> : announcements.error ? <AlertBox message={`Impossible de charger les annonces. ${errorText(announcements.error)}`} retry={() => announcements.refetch()} /> : (announcements.data ?? []).length === 0 ? <div className="empty-panel"><div className="empty-mark"><Bell size={22} /></div><h3>Aucune annonce pour le moment</h3><p>Les nouvelles informations apparaîtront dans cet espace dès leur publication.</p></div> : (announcements.data ?? []).map(a => <EventCard key={a.id} event={a} />)}</div>
    <div className="notice-foot"><ShieldCheck size={17} /><span>Les informations sont diffusées par les enseignants de la faculté.</span></div>
  </div>;
}

function DocumentDetailPage() {
  const [, params] = useRoute('/documents/:id');
  const id = Number(params?.id);
  const validId = Number.isInteger(id) && id > 0;
  const query = useGetDocument(validId ? id : 0, { query: { enabled: validId, queryKey: getGetDocumentQueryKey(validId ? id : 0) } });
  if (!validId) return <div className="content-wrap"><AlertBox message="Ce document n’existe pas ou son identifiant est invalide." /></div>;
  if (query.isLoading) return <div className="content-wrap detail-wrap"><LoadingRows /></div>;
  if (query.error || !query.data) return <div className="content-wrap detail-wrap"><Link href="/" className="back-link"><ArrowLeft size={16} /> Retour à la bibliothèque</Link><AlertBox message={`Impossible de trouver ce document. ${errorText(query.error)}`} retry={() => query.refetch()} /></div>;
  const doc = query.data;
  return <div className="content-wrap detail-wrap"><Link href="/" className="back-link"><ArrowLeft size={16} /> Retour à la bibliothèque</Link><div className="detail-layout"><div className="detail-cover"><div className="cover-top"><span>FASEG DOCS</span><span>SUPPORT DE COURS</span></div><div className="cover-emblem"><FileGlyph type={doc.contentType} /></div><div className="cover-title"><span>{doc.subject}</span><h1>{doc.title}</h1><p>{doc.level} <b>·</b> {doc.semester}</p></div><div className="cover-footer"><span>UNIVERSITÉ DE PARAKOU</span><span>PARAKOU, BÉNIN</span></div></div><div className="detail-content"><span className="section-kicker">RESSOURCE ACADÉMIQUE</span><h1>{doc.title}</h1><p className="detail-description">{doc.description || 'Ce support de cours a été mis à disposition par un enseignant de la faculté.'}</p><div className="detail-meta-grid"><div><span>MATIÈRE</span><b>{doc.subject}</b></div><div><span>NIVEAU</span><b>{doc.level}</b></div><div><span>SEMESTRE</span><b>{doc.semester}</b></div><div><span>AJOUTÉ LE</span><b>{formatDate(doc.createdAt)}</b></div></div><div className="file-info"><FileGlyph type={doc.contentType} /><span><b>{doc.fileName}</b><small>{doc.contentType} · {sizeLabel(doc.fileSize)}</small></span></div><a href={`/api/documents/${doc.id}/file`} className="button button-gold download-button" download={doc.fileName} data-testid={`link-download-${doc.id}`}><ArrowDownToLine size={18} /> Télécharger le document</a><WhatsAppShare message={`Support de cours FASEG — ${doc.title}`} className="detail-share" /><p className="download-caption"><ShieldCheck size={14} /> Téléchargement sécurisé · Source enseignante</p></div></div></div>;
}

function TeacherPage() {
  const queryClient = useQueryClient();
  const session = useGetTeacherSession({ query: { queryKey: getGetTeacherSessionQueryKey(), retry: false }, request: { credentials: 'include' } });
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const login = useTeacherLogin({ request: { credentials: 'include' } });
  const logout = useTeacherLogout({ request: { credentials: 'include' } });
  const deleteDoc = useDeleteDocument({ request: { credentials: 'include' } });
  const deleteAnnouncement = useDeleteAnnouncement({ request: { credentials: 'include' } });
  const authenticated = session.data?.authenticated === true;
  const [dialog, setDialog] = useState<'document' | 'announcement' | null>(null);
  const [editingDoc, setEditingDoc] = useState<AcademicDocument | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [toast, setToast] = useState('');
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey(), enabled: authenticated, retry: false }, request: { credentials: 'include' } });
  const docs = useListDocuments(undefined, { query: { queryKey: getListDocumentsQueryKey(), enabled: authenticated }, request: { credentials: 'include' } });
  const announcements = useListAnnouncements(undefined, { query: { queryKey: getListAnnouncementsQueryKey(), enabled: authenticated }, request: { credentials: 'include' } });

  const submitLogin = (e: FormEvent) => {
    e.preventDefault(); setLoginError('');
    login.mutate({ data: { password } }, { onSuccess: async () => { setPassword(''); await queryClient.invalidateQueries({ queryKey: getGetTeacherSessionQueryKey() }); }, onError: err => setLoginError(errorText(err, 'Mot de passe incorrect.')) });
  };
  const signOut = () => logout.mutate(undefined, { onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: getGetTeacherSessionQueryKey() }); }, onError: err => setToast(errorText(err)) });
  const openDocEditor = (doc?: AcademicDocument) => { setEditingDoc(doc ?? null); setDialog('document'); };
  const openAnnouncementEditor = (item?: Announcement) => { setEditingAnnouncement(item ?? null); setDialog('announcement'); };
  const finishModal = (message: string) => { setDialog(null); setEditingDoc(null); setEditingAnnouncement(null); setToast(message); window.setTimeout(() => setToast(''), 4000); };

  if (session.isLoading) return <div className="content-wrap teacher-loading"><div className="login-card-skeleton"><i /><i /><i /></div></div>;
  if (!authenticated) return <div className="teacher-login-page"><div className="login-aside"><div className="eyebrow light"><span /> ESPACE ENSEIGNANT</div><h1>Votre expertise,<br /><em>au service de tous.</em></h1><p>Publiez vos supports de cours et partagez les informations essentielles avec l’ensemble des étudiants.</p><div className="login-aside-bottom"><ShieldCheck size={18} /><span>Un espace protégé, réservé au corps enseignant de la FASEG.</span></div><div className="login-watermark">FASEG</div></div><div className="login-main"><Link href="/" className="back-link"><ArrowLeft size={16} /> Retour à l’accueil</Link><div className="login-card"><div className="login-mark"><LockKeyhole size={22} /></div><span className="section-kicker">ACCÈS SÉCURISÉ</span><h2>Connexion enseignant</h2><p>Connectez-vous pour gérer les ressources de votre faculté.</p><form onSubmit={submitLogin}><label className="form-label" htmlFor="teacher-password">Mot de passe partagé</label><input id="teacher-password" className="form-input" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Saisir votre mot de passe" autoComplete="current-password" data-testid="input-teacher-password" />{loginError && <div className="form-error" role="alert"><CircleAlert size={16} />{loginError}</div>}<button className="button button-navy full-button" disabled={login.isPending} data-testid="button-teacher-login">{login.isPending ? 'Vérification…' : <>Ouvrir mon espace <ArrowRight size={17} /></>}</button></form><div className="login-security"><ShieldCheck size={15} /> Votre session est sécurisée et temporaire.</div></div></div></div>;
  return <div className="content-wrap teacher-dashboard"><div className="dashboard-header"><div><div className="eyebrow"><span /> ESPACE ENSEIGNANT</div><h1>Tableau de bord</h1><p>Gérez les documents et les informations partagées avec vos étudiants.</p></div><button className="button button-outline" onClick={signOut} disabled={logout.isPending} data-testid="button-teacher-logout"><LogOut size={16} />{logout.isPending ? 'Déconnexion…' : 'Se déconnecter'}</button></div>
    {session.error && <AlertBox message={`Impossible de vérifier la session. ${errorText(session.error)}`} retry={() => session.refetch()} />}
    {toast && <div className="success-toast" role="status"><Check size={16} />{toast}</div>}
    {summary.error && <AlertBox message={`Le résumé est indisponible. ${errorText(summary.error)}`} retry={() => summary.refetch()} />}
    <div className="metric-grid">{[{ label: 'Documents publiés', number: summary.data?.documentCount, icon: BookOpen }, { label: 'Annonces publiées', number: summary.data?.announcementCount, icon: Bell }, { label: 'Échéances à venir', number: summary.data?.upcomingCount, icon: CalendarClock }].map(m => <div className="metric-card" key={m.label}><span className="metric-icon"><m.icon size={19} /></span><span className="metric-number">{summary.isLoading ? '—' : m.number ?? '—'}</span><span className="metric-label">{m.label}</span></div>)}</div>
     <div className="manage-columns"><section className="manage-panel"><div className="manage-heading"><div><span className="section-kicker">BIBLIOTHÈQUE</span><h2>Documents</h2></div><button className="button button-gold compact-button" onClick={() => openDocEditor()} data-testid="button-add-document"><Plus size={16} /> Ajouter</button></div>{docs.isLoading ? <LoadingRows /> : docs.error ? <AlertBox message={`Chargement impossible. ${errorText(docs.error)}`} retry={() => docs.refetch()} /> : !(docs.data ?? []).length ? <div className="manage-empty"><BookOpen size={19} /><span>Aucun document publié pour le moment.</span></div> : <div className="manage-list">{(docs.data ?? []).map(doc => <div className="manage-row" key={doc.id}><FileGlyph type={doc.contentType} /><div className="manage-row-title"><b>{doc.title}</b><span>{doc.subject} · {doc.level}</span></div><button className="small-icon-button" aria-label={`Modifier ${doc.title}`} onClick={() => openDocEditor(doc)} data-testid={`button-edit-document-${doc.id}`}><Pencil size={15} /></button><button className="small-icon-button danger-icon" aria-label={`Supprimer ${doc.title}`} onClick={() => { if (window.confirm(`Supprimer « ${doc.title} » ?`)) deleteDoc.mutate({ id: doc.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDocumentQueryKey(doc.id) }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); setToast('Document supprimé.'); }, onError: e => setToast(errorText(e)) }); }} data-testid={`button-delete-document-${doc.id}`}><Trash2 size={15} /></button></div>)}</div>}</section>
     <section className="manage-panel"><div className="manage-heading"><div><span className="section-kicker">COMMUNICATION</span><h2>Annonces</h2></div><button className="button button-gold compact-button" onClick={() => openAnnouncementEditor()} data-testid="button-add-announcement"><Plus size={16} /> Publier</button></div>{announcements.isLoading ? <LoadingRows /> : announcements.error ? <AlertBox message={`Chargement impossible. ${errorText(announcements.error)}`} retry={() => announcements.refetch()} /> : !(announcements.data ?? []).length ? <div className="manage-empty"><Bell size={19} /><span>Aucune annonce publiée pour le moment.</span></div> : <div className="manage-list">{(announcements.data ?? []).map(item => <div className="manage-row announcement-manage-row" key={item.id}><span className="manage-category-dot" /><div className="manage-row-title"><b>{item.title}</b><span>{categoryLabel[item.category]}{item.eventDate ? ` · ${formatDate(item.eventDate)}` : ''}</span></div><button className="small-icon-button" aria-label={`Modifier ${item.title}`} onClick={() => openAnnouncementEditor(item)} data-testid={`button-edit-announcement-${item.id}`}><Pencil size={15} /></button><button className="small-icon-button danger-icon" aria-label={`Supprimer ${item.title}`} onClick={() => { if (window.confirm(`Supprimer « ${item.title} » ?`)) deleteAnnouncement.mutate({ id: item.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); setToast('Annonce supprimée.'); }, onError: e => setToast(errorText(e)) }); }} data-testid={`button-delete-announcement-${item.id}`}><Trash2 size={15} /></button></div>)}</div>}</section></div>
    {dialog === 'document' && <Modal title={editingDoc ? 'Modifier le document' : 'Ajouter un document'} close={() => setDialog(null)}><DocumentForm initial={editingDoc} onDone={finishModal} /></Modal>}
    {dialog === 'announcement' && <Modal title={editingAnnouncement ? 'Modifier l’annonce' : 'Publier une annonce'} close={() => setDialog(null)}><AnnouncementForm initial={editingAnnouncement} onDone={finishModal} /></Modal>}
  </div>;
}

function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="section-kicker">ESPACE ENSEIGNANT</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={close} aria-label="Fermer"><X size={19} /></button></div>{children}</section></div>;
}

function DocumentForm({ initial, onDone }: { initial: AcademicDocument | null; onDone: (message: string) => void }) {
  const qc = useQueryClient();
  const upload = useRequestDocumentUpload({ request: { credentials: 'include' } });
  const create = useCreateDocument({ request: { credentials: 'include' } });
  const update = useUpdateDocument({ request: { credentials: 'include' } });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busyUpload, setBusyUpload] = useState(false);
  const [fields, setFields] = useState({ title: initial?.title ?? '', description: initial?.description ?? '', subject: initial?.subject ?? '', level: initial?.level ?? '', semester: initial?.semester ?? '' });
  const set = (key: keyof typeof fields, value: string) => setFields(prev => ({ ...prev, [key]: value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (initial) {
      update.mutate({ id: initial.id, data: fields }, { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() }); await qc.invalidateQueries({ queryKey: getGetDocumentQueryKey(initial.id) }); await qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); onDone('Document mis à jour.'); }, onError: err => setError(errorText(err)) });
      return;
    }
    if (!file) { setError('Sélectionnez un fichier à publier.'); return; }
    if (!allowedTypes.includes(file.type)) { setError('Format non pris en charge. Choisissez un PDF, JPEG, PNG ou WebP.'); return; }
    if (file.size > 25 * 1024 * 1024) { setError('Le fichier dépasse la limite de 25 Mo.'); return; }
    if (!file.size) { setError('Le fichier sélectionné est vide.'); return; }
    setBusyUpload(true);
    try {
      const ticket = await upload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' } });
      const put = await fetch(ticket.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error(`Échec du transfert du fichier (${put.status}).`);
      await create.mutateAsync({ data: { ...fields, fileName: file.name, contentType: file.type as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp', fileSize: file.size, objectPath: ticket.objectPath } });
      await qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() }); await qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); onDone('Document publié avec succès.');
    } catch (err) { setError(errorText(err, 'La publication du document a échoué.')); }
    finally { setBusyUpload(false); }
  };
  const pending = busyUpload || create.isPending || update.isPending || upload.isPending;
  return <form className="form-stack" onSubmit={submit}><div className="form-grid"><FormField label="Titre du document" required><input className="form-input" maxLength={180} required value={fields.title} onChange={e => set('title', e.target.value)} placeholder="Ex. Introduction à la microéconomie" data-testid="input-document-title" /></FormField><FormField label="Matière" required><input className="form-input" maxLength={120} required value={fields.subject} onChange={e => set('subject', e.target.value)} placeholder="Ex. Microéconomie" data-testid="input-document-subject" /></FormField><FormField label="Niveau" required><input className="form-input" maxLength={80} required value={fields.level} onChange={e => set('level', e.target.value)} placeholder="Ex. Licence 2" data-testid="input-document-level" /></FormField><FormField label="Semestre" required><input className="form-input" maxLength={80} required value={fields.semester} onChange={e => set('semester', e.target.value)} placeholder="Ex. Semestre 1" data-testid="input-document-semester" /></FormField></div><FormField label="Description"><textarea className="form-input form-textarea" maxLength={3000} value={fields.description} onChange={e => set('description', e.target.value)} placeholder="Quelques mots sur le contenu…" data-testid="input-document-description" /></FormField>{!initial && <FormField label="Fichier de cours" required><label className={`upload-zone ${file ? 'has-file' : ''}`}><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={e => { setFile(e.target.files?.[0] ?? null); setError(''); }} data-testid="input-document-file" /><UploadCloud size={22} /><b>{file ? file.name : 'Choisir un fichier'}</b><span>{file ? `${sizeLabel(file.size)} · ${file.type || 'type inconnu'}` : 'PDF, JPEG, PNG ou WebP · 25 Mo maximum'}</span></label></FormField>}{error && <div className="form-error" role="alert"><CircleAlert size={16} />{error}</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => onDone('')}>Annuler</button><button className="button button-navy" disabled={pending} data-testid="button-submit-document">{pending ? <><RefreshCw className="spin" size={16} /> Publication…</> : <>{initial ? 'Enregistrer les modifications' : 'Publier le document'} <ArrowRight size={16} /></>}</button></div></form>;
}
function FormField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="form-field"><span className="form-label">{label}{required && <i> *</i>}</span>{children}</label>;
}

function AnnouncementForm({ initial, onDone }: { initial: Announcement | null; onDone: (message: string) => void }) {
  const qc = useQueryClient();
  const create = useCreateAnnouncement({ request: { credentials: 'include' } });
  const update = useUpdateAnnouncement({ request: { credentials: 'include' } });
  const [error, setError] = useState('');
  const [fields, setFields] = useState({ title: initial?.title ?? '', content: initial?.content ?? '', category: initial?.category ?? 'announcement', subject: initial?.subject ?? '', level: initial?.level ?? '', eventDate: initial?.eventDate ?? '', startTime: initial?.startTime ?? '', endTime: initial?.endTime ?? '', location: initial ? (initial.location ?? '') : 'Parakou, Bénin' });
  const set = (key: keyof typeof fields, value: string) => setFields(prev => ({ ...prev, [key]: key === 'category' ? value as AnnouncementCategory : value } as typeof prev));
  const submit = (e: FormEvent) => {
    e.preventDefault(); setError('');
    // Date inputs provide the API's ISO calendar-date string directly; never convert this field to a timestamp.
    const data = { ...fields, subject: fields.subject || null, level: fields.level || null, eventDate: fields.eventDate || null, startTime: fields.startTime || null, endTime: fields.endTime || null, location: fields.location || null, category: fields.category as AnnouncementCategory };
    const onSuccess = async () => { await qc.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() }); await qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); onDone(initial ? 'Annonce mise à jour.' : 'Annonce publiée.'); };
    if (initial) update.mutate({ id: initial.id, data }, { onSuccess, onError: err => setError(errorText(err)) });
    else create.mutate({ data }, { onSuccess, onError: err => setError(errorText(err)) });
  };
  const pending = create.isPending || update.isPending;
  return <form className="form-stack" onSubmit={submit}><FormField label="Titre" required><input className="form-input" maxLength={180} required value={fields.title} onChange={e => set('title', e.target.value)} placeholder="Titre de l’information" data-testid="input-announcement-title" /></FormField><FormField label="Catégorie" required><select className="form-input" value={fields.category} onChange={e => set('category', e.target.value)} data-testid="select-announcement-category">{categories.slice(1).map(c => <option value={c.value} key={c.value}>{c.label}</option>)}</select></FormField><FormField label="Contenu" required><textarea className="form-input form-textarea larger-textarea" maxLength={5000} required value={fields.content} onChange={e => set('content', e.target.value)} placeholder="Détaillez l’information à transmettre aux étudiants…" data-testid="input-announcement-content" /></FormField><div className="form-grid"><FormField label="Matière"><input className="form-input" value={fields.subject} onChange={e => set('subject', e.target.value)} placeholder="Facultatif" data-testid="input-announcement-subject" /></FormField><FormField label="Niveau"><input className="form-input" value={fields.level} onChange={e => set('level', e.target.value)} placeholder="Ex. Licence 2" data-testid="input-announcement-level" /></FormField><FormField label="Date"><input type="date" className="form-input" value={fields.eventDate} onChange={e => set('eventDate', e.target.value)} data-testid="input-announcement-date" /></FormField><FormField label="Lieu"><input className="form-input" value={fields.location} onChange={e => set('location', e.target.value)} placeholder="Ex. Amphi A, Parakou" data-testid="input-announcement-location" /></FormField><FormField label="Heure de début"><input type="time" className="form-input" value={fields.startTime} onChange={e => set('startTime', e.target.value)} data-testid="input-announcement-start-time" /></FormField><FormField label="Heure de fin"><input type="time" className="form-input" value={fields.endTime} onChange={e => set('endTime', e.target.value)} data-testid="input-announcement-end-time" /></FormField></div>{error && <div className="form-error" role="alert"><CircleAlert size={16} />{error}</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => onDone('')}>Annuler</button><button className="button button-navy" disabled={pending} data-testid="button-submit-announcement">{pending ? 'Publication…' : initial ? 'Enregistrer les modifications' : 'Publier l’annonce'} <ArrowRight size={16} /></button></div></form>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function Router() {
  return <RoutedErrorBoundary><Shell><Switch><Route path="/" component={HomePage} /><Route path="/annonces" component={AnnouncementsPage} /><Route path="/enseignant" component={TeacherPage} /><Route path="/documents/:id" component={DocumentDetailPage} /><Route component={NotFound} /></Switch></Shell></RoutedErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;

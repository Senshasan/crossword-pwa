'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { BookOpen, Check, ChevronLeft, ChevronRight, Clock3, Grid2X2, LogOut, Moon, Play, RotateCcw, Sun, Users, Wifi, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type PuzzleType = 'standard' | 'custom'
type Puzzle = { id: string; title: string; subtitle: string; type: PuzzleType; order: number; size: number; grid: string[]; clue: string; accent: string }

const puzzles: Puzzle[] = [
  { id: 'p1', title: 'The Sunday Stroll', subtitle: 'A gentle warm-up', type: 'standard', order: 1, size: 5, grid: ['HELLO','EARTH','LLAMA','LIONS','OASIS'], clue: 'A friendly greeting', accent: 'sage' },
  { id: 'p2', title: 'Kitchen Table', subtitle: 'Family favorites', type: 'custom', order: 2, size: 5, grid: ['CRUMB','RECIPE','UMAMI','MIXER','BEANS'], clue: 'A tiny bit of bread', accent: 'coral' },
  { id: 'p3', title: 'Around the Block', subtitle: 'A bright little challenge', type: 'standard', order: 3, size: 5, grid: ['STARS','TRAIL','ROBIN','EERIE','SANDY'], clue: 'What you see at night', accent: 'blue' },
  { id: 'p4', title: 'Birthday Edition', subtitle: 'Made with love by the family', type: 'custom', order: 4, size: 5, grid: ['PARTY','APPLE','RIVER','TREAT','YOURS'], clue: 'A celebration', accent: 'gold' },
]

function flatten(puzzle: Puzzle) { return puzzle.grid.join('').split('') }
function initials(name: string) { return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() }

export default function Page() {
  const [view, setView] = useState<'home' | 'browse' | 'play'>('home')
  const [filter, setFilter] = useState<'All' | 'Standard' | 'Custom'>('All')
  const [active, setActive] = useState(puzzles[0])
  const [answers, setAnswers] = useState<string[]>(() => Array(25).fill(''))
  const [cursor, setCursor] = useState(0)
  const [completed, setCompleted] = useState<string[]>(['p1'])
  const [seconds, setSeconds] = useState(0)
  const [dark, setDark] = useState(true)
  const [showInstall, setShowInstall] = useState(false)
  const [name, setName] = useState('Alex')
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return
      setUser(data.user)
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', data.user.id).maybeSingle()
        if (profile?.display_name) setName(profile.display_name)
        setProfileReady(Boolean(profile?.display_name))
      }
      setAuthChecked(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session) { setProfileReady(false); setAuthChecked(true) }
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [supabase])
  useEffect(() => { if (view !== 'play') return; const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer) }, [view])
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined) }, [])

  const filtered = useMemo(() => puzzles.filter((puzzle) => filter === 'All' || puzzle.type === filter.toLowerCase()), [filter])
  const nextPuzzle = puzzles.find((puzzle) => !completed.includes(puzzle.id)) ?? puzzles[0]
  const progress = answers.filter(Boolean).length
  const isSolved = active.grid.join('') === answers.join('')

  function openPuzzle(puzzle: Puzzle) { setActive(puzzle); setAnswers(Array(puzzle.size * puzzle.size).fill('')); setCursor(0); setSeconds(0); setView('play') }
  function enterLetter(letter: string) { const next = [...answers]; next[cursor] = letter; setAnswers(next); if (next.every(Boolean)) { const correct = active.grid.join('') === next.join(''); if (correct) setCompleted((items) => [...new Set([...items, active.id])]) }; setCursor((cursor + 1) % next.length) }
  function moveCursor(delta: number) { setCursor((cursor + delta + answers.length) % answers.length) }
  async function signOut() { await supabase.auth.signOut(); setUser(null); setProfileReady(false) }
  async function saveProfile(displayName: string) {
    if (!user || !displayName.trim()) return
    const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: displayName.trim() })
    if (!error) { setName(displayName.trim()); setProfileReady(true) }
  }
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  if (!authChecked) return <LoadingScreen />
  if (!user) return <AuthScreen supabase={supabase} />
  if (!profileReady) return <ProfileScreen onSave={saveProfile} />

  return <main className="min-h-screen bg-background text-foreground">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <button className="flex items-center gap-3" onClick={() => setView('home')} aria-label="Go to home"><span className="brand-mark"><Grid2X2 size={19} strokeWidth={2.5} /></span><span className="text-lg font-semibold tracking-tight">Across & Along</span></button>
      <div className="flex items-center gap-2"><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button><button className="avatar" onClick={signOut} aria-label={`Sign out ${name}`} title="Sign out">{initials(name)}</button></div>
    </header>
    {view === 'play' ? <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8"><button className="back-link" onClick={() => setView('home')}><ChevronLeft size={17} /> Back to puzzles</button><div className="play-header"><div><span className={`eyebrow ${active.accent}`}>{active.type === 'custom' ? 'Family custom' : 'Standard puzzle'}</span><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{active.title}</h1><p className="mt-2 text-muted-foreground">{active.subtitle}</p></div><div className="timer"><Clock3 size={17} /><span>{time}</span></div></div><div className="play-layout"><div className="grid-wrap"><div className="crossword-grid" style={{ gridTemplateColumns: `repeat(${active.size}, minmax(0, 1fr))` }} role="grid" aria-label={`${active.title} crossword grid`}>{answers.map((answer, index) => <button key={index} className={`cell ${cursor === index ? 'selected' : ''} ${answer && answer === flatten(active)[index] ? 'filled' : ''}`} onClick={() => setCursor(index)} aria-label={`Cell ${index + 1}, ${answer || 'empty'}`}>{answer}</button>)}</div><div className="grid-controls"><button className="secondary-button" onClick={() => setAnswers(Array(25).fill(''))}><RotateCcw size={16} /> Clear</button><span className="text-sm text-muted-foreground">{progress} of 25 filled</span></div></div><aside className="clue-card"><div className="flex items-center justify-between"><span className="eyebrow">Across</span><span className="text-xs text-muted-foreground">1 clue</span></div><button className="clue-row"><span className="clue-number">1</span><span className="text-left text-sm font-medium">{active.clue}</span></button><div className="mt-8 border-t border-border pt-5"><p className="text-xs leading-5 text-muted-foreground">Tap a square, then use the letter keys below. Your progress syncs automatically when you&apos;re online.</p></div></aside></div><div className="keyboard" aria-label="Puzzle keyboard">{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => <button key={letter} onClick={() => enterLetter(letter)}>{letter}</button>)}<button className="wide-key" onClick={() => moveCursor(-1)}>⌫</button></div><div className="flex justify-center">{isSolved && <div className="success-banner"><Check size={19} /> Puzzle complete — lovely work.</div>}</div></section> : <><section className="hero mx-auto max-w-6xl px-5 pb-10 pt-10 sm:px-8 sm:pt-16"><div className="hero-copy"><span className="eyebrow sage">{completed.length} of {puzzles.length} complete</span><h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">A little puzzle,<br /><span className="text-accent">made for your people.</span></h1><p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">A private collection of crosswords for slow mornings, family group chats, and one very special birthday.</p><div className="mt-8 flex flex-wrap gap-3"><button className="primary-button" onClick={() => openPuzzle(nextPuzzle)}><Play size={17} fill="currentColor" /> Continue puzzle</button><button className="secondary-button" onClick={() => setShowInstall(true)}><Wifi size={16} /> Install app</button></div></div><div className="hero-note"><Users size={19} /><div><p className="font-medium">Just for us</p><p className="mt-1 text-sm leading-6 text-muted-foreground">No ads. No scores. Just a shared little tradition.</p></div></div></section><section className="mx-auto max-w-6xl px-5 pb-14 sm:px-8"><div className="section-heading"><div><p className="eyebrow">Your collection</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Pick a puzzle</h2></div><button className="browse-link" onClick={() => setView('browse')}>Browse all <ChevronRight size={16} /></button></div><div className="puzzle-grid">{puzzles.slice(0, 3).map((puzzle) => <PuzzleCard key={puzzle.id} puzzle={puzzle} done={completed.includes(puzzle.id)} onOpen={openPuzzle} />)}</div><div className="family-strip"><div className="family-icon"><Users size={20} /></div><div><p className="font-medium">The family shelf</p><p className="mt-1 text-sm text-muted-foreground">Custom puzzles appear here at the milestones they were made for.</p></div><button className="icon-button ml-auto" onClick={() => setView('browse')} aria-label="View family shelf"><ChevronRight size={18} /></button></div></section>{showInstall && <div className="modal-backdrop" onClick={() => setShowInstall(false)}><div className="install-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowInstall(false)} aria-label="Close"><X size={18} /></button><span className="brand-mark large"><Grid2X2 size={24} /></span><h2 className="mt-5 text-2xl font-semibold">Keep it close</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">On iPhone or iPad, tap Share in Safari, then choose <strong className="text-foreground">Add to Home Screen</strong>. It will open like a real app.</p><button className="primary-button mt-6 w-full" onClick={() => setShowInstall(false)}>Got it</button></div></div>}</>}
  </main>
}

function PuzzleCard({ puzzle, done, onOpen }: { puzzle: Puzzle; done: boolean; onOpen: (puzzle: Puzzle) => void }) { return <button className="puzzle-card text-left" onClick={() => onOpen(puzzle)}><div className={`mini-grid ${puzzle.accent}`}>{puzzle.grid.slice(0, 9).map((letter, index) => <span key={index}>{index % 4 === 0 ? '' : letter}</span>)}</div><div className="card-content"><div className="flex items-center justify-between"><span className={`eyebrow ${puzzle.accent}`}>{puzzle.type === 'custom' ? 'Custom' : 'Standard'}</span>{done && <span className="done-badge"><Check size={12} /> Done</span>}</div><h3 className="mt-3 font-semibold">{puzzle.title}</h3><p className="mt-1 text-sm text-muted-foreground">{puzzle.subtitle}</p></div></button> }

function LoadingScreen() { return <main className="auth-shell"><div className="auth-card"><span className="brand-mark"><Grid2X2 size={19} /></span><p className="mt-5 text-sm text-muted-foreground">Loading your collection…</p></div></main> }

function AuthScreen({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function requestCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    setBusy(false)
    if (error) setMessage('We couldn’t send a code. Check the email and try again.')
    else setStep('code')
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setMessage('That code is invalid or expired. Please request a new one.')
  }

  return <main className="auth-shell"><div className="auth-card"><span className="brand-mark"><Grid2X2 size={19} /></span><p className="eyebrow mt-8">A private family collection</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome to Across & Along</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in with a one-time code. No password to remember, no ads, just puzzles.</p>{step === 'email' ? <form className="mt-8 space-y-4" onSubmit={requestCode}><label className="block text-sm font-medium" htmlFor="email">Email address</label><input className="auth-input" id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /><button className="primary-button w-full justify-center" disabled={busy}>{busy ? 'Sending code…' : 'Send me a code'}<ChevronRight size={17} /></button></form> : <form className="mt-8 space-y-4" onSubmit={verifyCode}><label className="block text-sm font-medium" htmlFor="code">6-digit code</label><input className="auth-input text-center text-2xl tracking-[0.35em]" id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /><button className="primary-button w-full justify-center" disabled={busy}>{busy ? 'Checking code…' : 'Enter the collection'}<ChevronRight size={17} /></button><button type="button" className="back-link mx-auto" onClick={() => { setStep('email'); setCode(''); setMessage('') }}><ChevronLeft size={17} /> Use a different email</button></form>}{message && <p role="alert" className="mt-4 text-sm text-coral">{message}</p>}<p className="mt-8 text-xs leading-5 text-muted-foreground">Check your inbox for a six-digit code. Your session stays with this app, even on iPhone.</p></div></main>
}

function ProfileScreen({ onSave }: { onSave: (name: string) => Promise<void> }) {
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); await onSave(displayName); setBusy(false) }
  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}><span className="brand-mark"><Users size={19} /></span><p className="eyebrow mt-8">One last detail</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">What should we call you?</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">This name appears on your private puzzle collection.</p><label className="mt-8 block text-sm font-medium" htmlFor="display-name">Display name</label><input className="auth-input mt-2" id="display-name" autoFocus required value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" /><button className="primary-button mt-4 w-full justify-center" disabled={busy}>{busy ? 'Saving…' : 'Save my name'}<ChevronRight size={17} /></button></form></main>
}

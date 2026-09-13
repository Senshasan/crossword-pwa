'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, ChevronLeft, ChevronRight, Clock3, Grid2X2, LogOut, Moon, Play, RotateCcw, Sun, Users, Wifi, X } from 'lucide-react'

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

  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  useEffect(() => { if (view !== 'play') return; const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer) }, [view])
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined) }, [])

  const filtered = useMemo(() => puzzles.filter((puzzle) => filter === 'All' || puzzle.type === filter.toLowerCase()), [filter])
  const nextPuzzle = puzzles.find((puzzle) => !completed.includes(puzzle.id)) ?? puzzles[0]
  const progress = answers.filter(Boolean).length
  const isSolved = active.grid.join('') === answers.join('')

  function openPuzzle(puzzle: Puzzle) { setActive(puzzle); setAnswers(Array(puzzle.size * puzzle.size).fill('')); setCursor(0); setSeconds(0); setView('play') }
  function enterLetter(letter: string) { const next = [...answers]; next[cursor] = letter; setAnswers(next); if (next.every(Boolean)) { const correct = active.grid.join('') === next.join(''); if (correct) setCompleted((items) => [...new Set([...items, active.id])]) }; setCursor((cursor + 1) % next.length) }
  function moveCursor(delta: number) { setCursor((cursor + delta + answers.length) % answers.length) }
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return <main className="min-h-screen bg-background text-foreground">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <button className="flex items-center gap-3" onClick={() => setView('home')} aria-label="Go to home"><span className="brand-mark"><Grid2X2 size={19} strokeWidth={2.5} /></span><span className="text-lg font-semibold tracking-tight">Across & Along</span></button>
      <div className="flex items-center gap-2"><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button><button className="avatar" aria-label="Profile">{initials(name)}</button></div>
    </header>
    {view === 'play' ? <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8"><button className="back-link" onClick={() => setView('home')}><ChevronLeft size={17} /> Back to puzzles</button><div className="play-header"><div><span className={`eyebrow ${active.accent}`}>{active.type === 'custom' ? 'Family custom' : 'Standard puzzle'}</span><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{active.title}</h1><p className="mt-2 text-muted-foreground">{active.subtitle}</p></div><div className="timer"><Clock3 size={17} /><span>{time}</span></div></div><div className="play-layout"><div className="grid-wrap"><div className="crossword-grid" style={{ gridTemplateColumns: `repeat(${active.size}, minmax(0, 1fr))` }} role="grid" aria-label={`${active.title} crossword grid`}>{answers.map((answer, index) => <button key={index} className={`cell ${cursor === index ? 'selected' : ''} ${answer && answer === flatten(active)[index] ? 'filled' : ''}`} onClick={() => setCursor(index)} aria-label={`Cell ${index + 1}, ${answer || 'empty'}`}>{answer}</button>)}</div><div className="grid-controls"><button className="secondary-button" onClick={() => setAnswers(Array(25).fill(''))}><RotateCcw size={16} /> Clear</button><span className="text-sm text-muted-foreground">{progress} of 25 filled</span></div></div><aside className="clue-card"><div className="flex items-center justify-between"><span className="eyebrow">Across</span><span className="text-xs text-muted-foreground">1 clue</span></div><button className="clue-row"><span className="clue-number">1</span><span className="text-left text-sm font-medium">{active.clue}</span></button><div className="mt-8 border-t border-border pt-5"><p className="text-xs leading-5 text-muted-foreground">Tap a square, then use the letter keys below. Your progress syncs automatically when you&apos;re online.</p></div></aside></div><div className="keyboard" aria-label="Puzzle keyboard">{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => <button key={letter} onClick={() => enterLetter(letter)}>{letter}</button>)}<button className="wide-key" onClick={() => moveCursor(-1)}>⌫</button></div><div className="flex justify-center">{isSolved && <div className="success-banner"><Check size={19} /> Puzzle complete — lovely work.</div>}</div></section> : <><section className="hero mx-auto max-w-6xl px-5 pb-10 pt-10 sm:px-8 sm:pt-16"><div className="hero-copy"><span className="eyebrow sage">{completed.length} of {puzzles.length} complete</span><h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">A little puzzle,<br /><span className="text-accent">made for your people.</span></h1><p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">A private collection of crosswords for slow mornings, family group chats, and one very special birthday.</p><div className="mt-8 flex flex-wrap gap-3"><button className="primary-button" onClick={() => openPuzzle(nextPuzzle)}><Play size={17} fill="currentColor" /> Continue puzzle</button><button className="secondary-button" onClick={() => setShowInstall(true)}><Wifi size={16} /> Install app</button></div></div><div className="hero-note"><Users size={19} /><div><p className="font-medium">Just for us</p><p className="mt-1 text-sm leading-6 text-muted-foreground">No ads. No scores. Just a shared little tradition.</p></div></div></section><section className="mx-auto max-w-6xl px-5 pb-14 sm:px-8"><div className="section-heading"><div><p className="eyebrow">Your collection</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Pick a puzzle</h2></div><button className="browse-link" onClick={() => setView('browse')}>Browse all <ChevronRight size={16} /></button></div><div className="puzzle-grid">{puzzles.slice(0, 3).map((puzzle) => <PuzzleCard key={puzzle.id} puzzle={puzzle} done={completed.includes(puzzle.id)} onOpen={openPuzzle} />)}</div><div className="family-strip"><div className="family-icon"><Users size={20} /></div><div><p className="font-medium">The family shelf</p><p className="mt-1 text-sm text-muted-foreground">Custom puzzles appear here at the milestones they were made for.</p></div><button className="icon-button ml-auto" onClick={() => setView('browse')} aria-label="View family shelf"><ChevronRight size={18} /></button></div></section>{showInstall && <div className="modal-backdrop" onClick={() => setShowInstall(false)}><div className="install-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowInstall(false)} aria-label="Close"><X size={18} /></button><span className="brand-mark large"><Grid2X2 size={24} /></span><h2 className="mt-5 text-2xl font-semibold">Keep it close</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">On iPhone or iPad, tap Share in Safari, then choose <strong className="text-foreground">Add to Home Screen</strong>. It will open like a real app.</p><button className="primary-button mt-6 w-full" onClick={() => setShowInstall(false)}>Got it</button></div></div>}</>}
  </main>
}

function PuzzleCard({ puzzle, done, onOpen }: { puzzle: Puzzle; done: boolean; onOpen: (puzzle: Puzzle) => void }) { return <button className="puzzle-card text-left" onClick={() => onOpen(puzzle)}><div className={`mini-grid ${puzzle.accent}`}>{puzzle.grid.slice(0, 9).map((letter, index) => <span key={index}>{index % 4 === 0 ? '' : letter}</span>)}</div><div className="card-content"><div className="flex items-center justify-between"><span className={`eyebrow ${puzzle.accent}`}>{puzzle.type === 'custom' ? 'Custom' : 'Standard'}</span>{done && <span className="done-badge"><Check size={12} /> Done</span>}</div><h3 className="mt-3 font-semibold">{puzzle.title}</h3><p className="mt-1 text-sm text-muted-foreground">{puzzle.subtitle}</p></div></button> }

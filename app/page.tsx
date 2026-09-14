'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { BookOpen, Check, ChevronLeft, ChevronRight, Clock3, Grid2X2, LogOut, Moon, RotateCcw, Sun, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { type CellData, type Clue, type Direction, type PuzzleData, validatePuzzleData } from '@/lib/crossword'

type ProgressRow = {
  puzzle_id: string
  cell_state: string[]
  completed: boolean
  solve_time_seconds: number | null
  completed_at: string | null
  updated_at: string
}

type PuzzleRow = {
  id: string
  title: string
  puzzle_type: 'standard' | 'custom'
  order_index: number
  width: number
  height: number
  grid: string[]
  clues: { across: Clue[]; down: Clue[] }
}

function mapPuzzle(row: PuzzleRow): PuzzleData | null {
  if (!row.id || !row.title || !Number.isInteger(row.width) || !Number.isInteger(row.height) || row.width < 1 || row.height < 1 || row.width > 30 || row.height > 30 || !Array.isArray(row.grid) || row.grid.length !== row.width * row.height || !row.clues || !Array.isArray(row.clues.across) || !Array.isArray(row.clues.down)) return null
  const grid: CellData[][] = Array.from({ length: row.height }, (_, rowIndex) => Array.from({ length: row.width }, (_, colIndex) => {
    const letter = typeof row.grid[rowIndex * row.width + colIndex] === 'string' ? row.grid[rowIndex * row.width + colIndex].toUpperCase() : '#'
    return { row: rowIndex, col: colIndex, letter, isBlocked: letter === '#' }
  }))
  const clues = { across: row.clues.across.map((clue) => ({ ...clue, direction: 'across' as const })), down: row.clues.down.map((clue) => ({ ...clue, direction: 'down' as const })) }
  const numberByStart = new Map<string, number>()
  ;[...clues.across, ...clues.down].forEach((clue) => numberByStart.set(`${clue.row}:${clue.col}`, clue.number))
  clues.across.forEach((clue, id) => { for (let col = clue.col; col < row.width && !grid[clue.row][col].isBlocked; col++) grid[clue.row][col].acrossClueId = id })
  clues.down.forEach((clue, id) => { for (let rowIndex = clue.row; rowIndex < row.height && !grid[rowIndex][clue.col].isBlocked; rowIndex++) grid[rowIndex][clue.col].downClueId = id })
  grid.flat().forEach((cell) => { cell.clueNumber = numberByStart.get(`${cell.row}:${cell.col}`) })
  const puzzle: PuzzleData = { id: row.id, title: row.title, category: row.puzzle_type, orderIndex: row.order_index, dimensions: { rows: row.height, cols: row.width }, clues, grid }
  return validatePuzzleData(puzzle).valid ? puzzle : null
} 

function answersFromState(puzzle: PuzzleData, cellState: string[]) {
  return puzzle.grid.flat().reduce<Record<string, string>>((result, cell, index) => {
    if (!cell.isBlocked && cellState[index]) result[keyFor(cell.row, cell.col)] = cellState[index]
    return result
  }, {})
} 

function cellStateFor(puzzle: PuzzleData, answers: Record<string, string>) {
  return puzzle.grid.flat().map((cell) => cell.isBlocked ? '#' : answers[keyFor(cell.row, cell.col)] ?? '')
} 

const emptyPuzzle: PuzzleData = { id: '', title: '', category: 'standard', orderIndex: 0, dimensions: { rows: 1, cols: 1 }, clues: { across: [], down: [] }, grid: [[{ row: 0, col: 0, letter: '', isBlocked: true }]] } 
const keyFor = (row: number, col: number) => `${row}:${col}`
const allCells = (p: PuzzleData) => p.grid.flat().filter((cell) => !cell.isBlocked)
export default function Page() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const [name, setName] = useState('')
  const [dark, setDark] = useState(true)
  const [view, setView] = useState<'home' | 'browse' | 'play'>('home')
  const [filter, setFilter] = useState<'all' | 'standard' | 'custom'>('all')
  const [puzzles, setPuzzles] = useState<PuzzleData[]>([])
  const [active, setActive] = useState<PuzzleData>(emptyPuzzle)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [puzzleLoading, setPuzzleLoading] = useState(true)
  const lastKnownUpdatedAt = useRef<string | null>(null)
  const saveTimer = useRef<number | null>(null)
  const pendingSave = useRef<{ state: Record<string, string>; done: boolean; puzzleId: string } | null>(null)
  const [direction, setDirection] = useState<Direction>('across')
  const [cursor, setCursor] = useState({ row: 0, col: 0 })
  const [seconds, setSeconds] = useState(0)
  const [completed, setCompleted] = useState<string[]>([])
  const [modal, setModal] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  useEffect(() => {
    let mounted = true
    setAuthChecked(true)
    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return
      setUser(data.user)
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', data.user.id).maybeSingle()
        if (profile?.display_name) { setName(profile.display_name); setProfileReady(true) }
        const { data: progress } = await supabase.from('puzzle_progress').select('puzzle_id, completed').eq('user_id', data.user.id)
        setCompleted(progress?.filter((row) => row.completed).map((row) => row.puzzle_id) ?? [])
        const { data: puzzleRows } = await supabase.from('puzzles').select('id,title,puzzle_type,order_index,width,height,grid,clues').order('order_index')
        if (puzzleRows) setPuzzles((puzzleRows as PuzzleRow[]).map(mapPuzzle).filter((puzzle): puzzle is PuzzleData => puzzle !== null))
        setPuzzleLoading(false)
      }
      setAuthChecked(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); if (!session) setProfileReady(false) })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [supabase])
  useEffect(() => { if (view !== 'play' || modal) return; const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000); return () => window.clearInterval(timer) }, [view, modal])
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined) }, [])

  const filtered = puzzles.filter((p) => filter === 'all' || p.category === filter)
  const nextPuzzle = puzzles.find((p) => !completed.includes(p.id)) ?? puzzles[0]
  const activeClue = findActiveClue(active, cursor, direction)
  const wordCells = activeClue ? getWordCells(active, activeClue) : []
  const isSolved = allCells(active).every((cell) => answers[keyFor(cell.row, cell.col)] === cell.letter)
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  async function openPuzzle(puzzle: PuzzleData) {
    setActive(puzzle); setView('play'); setSeconds(0); setModal(false); setAnswers({});
    const first = allCells(puzzle)[0]
    if (first) { setCursor({ row: first.row, col: first.col }); setDirection('across') }
    if (user) {
      const { data } = await supabase.from('puzzle_progress').select('cell_state,completed,solve_time_seconds,updated_at').eq('user_id', user.id).eq('puzzle_id', puzzle.id).maybeSingle()
      if (data) { lastKnownUpdatedAt.current = data.updated_at; setAnswers(answersFromState(puzzle, data.cell_state ?? [])); setSeconds(data.solve_time_seconds ?? 0) }
      else lastKnownUpdatedAt.current = null
    }
    window.setTimeout(() => inputRef.current?.focus(), 100)
  }
  function focusCell(row: number, col: number, toggle = false) {
    const cell = active.grid[row][col]; if (cell.isBlocked) return
    if (toggle && cell.acrossClueId !== undefined && cell.downClueId !== undefined) setDirection((d) => d === 'across' ? 'down' : 'across')
    setCursor({ row, col }); inputRef.current?.focus()
  }
  function setLetter(letter: string) {
    const cell = active.grid[cursor.row][cursor.col]; if (!cell || cell.isBlocked) return
    const next = { ...answers, [keyFor(cursor.row, cursor.col)]: letter.toUpperCase() }; setAnswers(next)
    const nextCell = wordCells[wordCells.findIndex((c) => c.row === cursor.row && c.col === cursor.col) + 1]
    if (nextCell) setCursor({ row: nextCell.row, col: nextCell.col })
    if (allCells(active).every((c) => next[keyFor(c.row, c.col)] === c.letter)) { setCompleted((items) => [...new Set([...items, active.id])]); setModal(true); saveProgress(next, true) }
    else saveProgress(next, false)
  }
  function handleKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (/^[a-zA-Z]$/.test(event.key)) { event.preventDefault(); setLetter(event.key); return }
    if (event.key === 'Backspace') { event.preventDefault(); const current = keyFor(cursor.row, cursor.col); if (answers[current]) setAnswers({ ...answers, [current]: '' }); else { const index = wordCells.findIndex((c) => c.row === cursor.row && c.col === cursor.col); const previous = wordCells[index - 1]; if (previous) { setCursor({ row: previous.row, col: previous.col }); setAnswers({ ...answers, [keyFor(previous.row, previous.col)]: '' }) } } return }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); moveArrow(event.key); }
  }
  function moveArrow(key: string) { const delta = key === 'ArrowLeft' ? [0, -1] : key === 'ArrowRight' ? [0, 1] : key === 'ArrowUp' ? [-1, 0] : [1, 0]; let r = cursor.row + delta[0], c = cursor.col + delta[1]; while (r >= 0 && c >= 0 && r < active.dimensions.rows && c < active.dimensions.cols && active.grid[r][c].isBlocked) { r += delta[0]; c += delta[1] } if (r >= 0 && c >= 0 && r < active.dimensions.rows && c < active.dimensions.cols) focusCell(r, c) }
  function checkWord() { const next = { ...answers }; wordCells.forEach((cell) => { const expected = active.grid[cell.row][cell.col].letter; if (next[keyFor(cell.row, cell.col)] && next[keyFor(cell.row, cell.col)] !== expected) next[keyFor(cell.row, cell.col)] = '' }); setAnswers(next); saveProgress(next, false) }
  function checkGrid() { const next = { ...answers }; allCells(active).forEach((cell) => { if (next[keyFor(cell.row, cell.col)] && next[keyFor(cell.row, cell.col)] !== cell.letter) next[keyFor(cell.row, cell.col)] = '' }); setAnswers(next); saveProgress(next, false) }
  function reset() { const next = {}; setAnswers(next); setSeconds(0); setModal(false); saveProgress(next, false) }
  async function flushProgress() {
    const pending = pendingSave.current
    if (!user || !pending || pending.puzzleId !== active.id) return
    pendingSave.current = null
    const cellState = cellStateFor(active, pending.state)
    const now = new Date().toISOString()
    let query = supabase.from('puzzle_progress').update({ cell_state: cellState, completed: pending.done, solve_time_seconds: pending.done ? seconds : null, completed_at: pending.done ? now : null, updated_at: now }).eq('user_id', user.id).eq('puzzle_id', active.id)
    if (lastKnownUpdatedAt.current) query = query.eq('updated_at', lastKnownUpdatedAt.current)
    const { data, error } = await query.select('updated_at').maybeSingle()
    if (error) { pendingSave.current = pending; return }
    if (data) { lastKnownUpdatedAt.current = data.updated_at; return }
    const { data: server } = await supabase.from('puzzle_progress').select('cell_state,updated_at').eq('user_id', user.id).eq('puzzle_id', active.id).maybeSingle()
    if (server) { lastKnownUpdatedAt.current = server.updated_at; setAnswers(answersFromState(active, server.cell_state ?? [])); return }
    const { data: inserted } = await supabase.from('puzzle_progress').insert({ user_id: user.id, puzzle_id: active.id, cell_state: cellState, completed: pending.done, solve_time_seconds: pending.done ? seconds : null, completed_at: pending.done ? now : null, updated_at: now }).select('updated_at').single()
    if (inserted) lastKnownUpdatedAt.current = inserted.updated_at
    else pendingSave.current = pending
  }
  function saveProgress(state: Record<string, string>, done: boolean) {
    if (!user || !active.id) return
    pendingSave.current = { state, done, puzzleId: active.id }
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { void flushProgress() }, done ? 0 : 2500)
  }
  useEffect(() => {
    const flush = () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); void flushProgress() }
    window.addEventListener('online', flush)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
    return () => { window.removeEventListener('online', flush); if (saveTimer.current) window.clearTimeout(saveTimer.current); flush() }
  }, [user, active.id, seconds])
  async function saveProfile(value: string) { if (!user || !value.trim()) return; const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: value.trim() }); if (!error) { setName(value.trim()); setProfileReady(true) } }

  if (!authChecked) return <LoadingScreen />
  if (!user) return <AuthScreen supabase={supabase} />
  if (!profileReady) return <ProfileScreen onSave={saveProfile} />
  if (puzzleLoading) return <LoadingScreen />
  if (!puzzles.length) return <main className="auth-shell"><div className="auth-card"><span className="brand-mark"><Grid2X2 size={19} /></span><h1 className="mt-5 text-2xl font-semibold">Your collection is getting ready</h1><p className="mt-3 text-sm text-muted-foreground">No puzzles have been added yet.</p></div></main>
  if (view === 'play') return <PlayScreen active={active} answers={answers} cursor={cursor} direction={direction} activeClue={activeClue} wordCells={wordCells} seconds={seconds} time={time} inputRef={inputRef} onKey={handleKey} onCell={focusCell} onDirection={setDirection} onClue={(clue: Clue) => { setCursor({ row: clue.row, col: clue.col }); setDirection(clue.direction); inputRef.current?.focus() }} onBack={() => setView('home')} onCheckWord={checkWord} onCheckGrid={checkGrid} onReset={reset} modal={modal} onCloseModal={() => setModal(false)} />

  return <main className="min-h-screen bg-background text-foreground"><header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8"><button className="flex items-center gap-3" onClick={() => setView('home')}><span className="brand-mark"><Grid2X2 size={19} /></span><span className="text-lg font-semibold">Across & Along</span></button><div className="flex items-center gap-2"><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button><button className="avatar" onClick={() => supabase.auth.signOut()} aria-label="Sign out">{name.slice(0, 2).toUpperCase()}</button></div></header><section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8"><div className="hero"><div><p className="eyebrow sage">Your private collection</p><h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight sm:text-6xl">A little time together, one square at a time.</h1><p className="mt-5 max-w-lg leading-7 text-muted-foreground">A free, ad-free crossword collection made for family and friends.</p></div><div className="hero-note"><BookOpen size={18} /><p className="text-sm leading-5">On iPhone? Use Safari&apos;s Share menu to add this app to your Home Screen.</p></div></div><div className="mt-14 flex items-end justify-between"><div><p className="eyebrow">Continue</p><h2 className="mt-2 text-2xl font-semibold">Pick up where you left off</h2></div><button className="browse-link" onClick={() => setView('browse')}>Browse all <ChevronRight size={16} /></button></div><button className="continue-card mt-5 w-full text-left" onClick={() => openPuzzle(nextPuzzle)}><div><span className={`eyebrow ${nextPuzzle.category === 'custom' ? 'coral' : 'sage'}`}>{nextPuzzle.category === 'custom' ? 'Family custom' : 'Standard puzzle'}</span><h3 className="mt-3 text-2xl font-semibold">{nextPuzzle.title}</h3><p className="mt-2 text-sm text-muted-foreground">{nextPuzzle.clues.across[0].text}</p></div><span className="play-circle"><ChevronRight size={23} /></span></button><div className="section-heading mt-14"><div><p className="eyebrow">The collection</p><h2 className="mt-2 text-2xl font-semibold">All puzzles</h2></div><button className="browse-link" onClick={() => setView('browse')}>See collection <ChevronRight size={16} /></button></div><div className="puzzle-grid">{puzzles.slice(0, 3).map((puzzle) => <PuzzleCard key={puzzle.id} puzzle={puzzle} done={completed.includes(puzzle.id)} onOpen={openPuzzle} />)}</div></section></main>
}

function getWordCells(puzzle: PuzzleData, clue: Clue) { const cells: { row: number; col: number }[] = []; let r = clue.row, c = clue.col; while (r < puzzle.dimensions.rows && c < puzzle.dimensions.cols && !puzzle.grid[r][c].isBlocked) { cells.push({ row: r, col: c }); if (clue.direction === 'across') c++; else r++ } return cells }
function findActiveClue(puzzle: PuzzleData, cursor: { row: number; col: number }, direction: Direction) { const cell = puzzle.grid[cursor.row][cursor.col]; const id = direction === 'across' ? cell.acrossClueId : cell.downClueId; return id === undefined ? puzzle.clues[direction][0] : puzzle.clues[direction][id] }
function PuzzleCard({ puzzle, done, onOpen }: { puzzle: PuzzleData; done: boolean; onOpen: (p: PuzzleData) => void }) { return <button className="puzzle-card text-left" onClick={() => onOpen(puzzle)}><div className={`mini-grid ${puzzle.category === 'custom' ? 'coral' : 'sage'}`}>{puzzle.grid[0].map((cell, i) => <span key={i}>{cell.letter}</span>)}</div><div className="card-content"><div className="flex items-center justify-between"><span className={`eyebrow ${puzzle.category === 'custom' ? 'coral' : 'sage'}`}>{puzzle.category}</span>{done && <span className="done-badge"><Check size={12} /> Done</span>}</div><h3 className="mt-3 font-semibold">{puzzle.title}</h3><p className="mt-1 text-sm text-muted-foreground">{puzzle.clues.across[0].text}</p></div></button> }

function PlayScreen({ active, answers, cursor, direction, activeClue, wordCells, seconds, time, inputRef, onKey, onCell, onDirection, onClue, onBack, onCheckWord, onCheckGrid, onReset, modal, onCloseModal }: any) { const wordSet = new Set(wordCells.map((c: any) => keyFor(c.row, c.col))); return <main className="min-h-screen bg-background text-foreground"><header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8"><button className="back-link" onClick={onBack}><ChevronLeft size={17} /> Back to puzzles</button><div className="timer"><Clock3 size={17} /> {time}</div></header><section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8"><div className="play-header"><div><span className={`eyebrow ${active.category === 'custom' ? 'coral' : 'sage'}`}>{active.category === 'custom' ? 'Family custom' : 'Standard puzzle'}</span><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{active.title}</h1></div></div><input ref={inputRef} className="keyboard-input" autoFocus onKeyDown={onKey} autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text" aria-label="Type crossword letters" /><div className="play-layout mt-8"><div className="grid-wrap"><div className="crossword-grid real-grid" style={{ gridTemplateColumns: `repeat(${active.dimensions.cols}, minmax(0, 1fr))` }} role="grid" onClick={() => inputRef.current?.focus()}>{active.grid.map((row: any[], r: number) => row.map((cell: any, c: number) => { const key = keyFor(r, c); return <button key={key} className={`cell ${cell.isBlocked ? 'blocked' : ''} ${wordSet.has(key) ? 'word-active' : ''} ${cursor.row === r && cursor.col === c ? 'selected' : ''}`} onClick={(event) => { event.stopPropagation(); onCell(r, c, cursor.row === r && cursor.col === c) }} aria-label={`Row ${r + 1}, column ${c + 1}`}>{cell.clueNumber !== undefined && <small>{cell.clueNumber}</small>}{answers[key] ?? ''}</button> }))}</div><div className="grid-controls"><button className="secondary-button" onClick={onReset}><RotateCcw size={16} /> Reset</button><button className="secondary-button" onClick={onCheckWord}>Check Word</button><button className="secondary-button" onClick={onCheckGrid}>Check Grid</button></div></div><aside className="clue-card"><div className="clue-tabs"><button className={direction === 'across' ? 'active' : ''} onClick={() => onDirection('across')}>Across</button><button className={direction === 'down' ? 'active' : ''} onClick={() => onDirection('down')}>Down</button></div><div className="sticky-clue"><span className="clue-number">{activeClue?.number}</span><p>{activeClue?.text}</p></div><div className="clue-list">{active.clues[direction].map((clue: Clue) => <button key={`${clue.direction}-${clue.number}`} className="clue-row" onClick={() => onClue(clue)}><span className="clue-number">{clue.number}</span><span>{clue.text}</span></button>)}</div></aside></div></section>{modal && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="success-modal"><button className="modal-close" onClick={onCloseModal} aria-label="Close"><X size={18} /></button><span className="brand-mark large"><Check size={25} /></span><p className="eyebrow sage mt-6">Puzzle complete</p><h2 className="mt-2 text-3xl font-semibold">Well done.</h2><p className="mt-3 text-muted-foreground">Solved in {time}.</p>{active.category === 'custom' && <p className="mt-5 leading-6">{active.congratsMessage}<br /><span className="text-sm text-muted-foreground">— {active.authorName}</span></p>}<button className="primary-button mt-7 w-full" onClick={onCloseModal}>Keep solving</button></div></div>}</main> }

function LoadingScreen() { return <main className="auth-shell"><div className="auth-card"><span className="brand-mark"><Grid2X2 size={19} /></span><p className="mt-5 text-sm text-muted-foreground">Loading your collection…</p></div></main> }
function AuthScreen({ supabase }: { supabase: ReturnType<typeof createClient> }) { const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [step, setStep] = useState<'email' | 'code'>('email'); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setMessage(''); const result = step === 'email' ? await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } }) : await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' }); setBusy(false); if (result.error) setMessage('That request could not be completed. Please try again.'); else setStep('code') } return <main className="auth-shell"><form className="auth-card" onSubmit={submit}><span className="brand-mark"><Grid2X2 size={19} /></span><p className="eyebrow mt-8">A private family collection</p><h1 className="mt-3 text-3xl font-semibold">Welcome to Across & Along</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in with a one-time code. No password to remember, no ads.</p><label className="mt-8 block text-sm font-medium" htmlFor="auth-value">{step === 'email' ? 'Email address' : '6-digit code'}</label><input className="auth-input mt-2" id="auth-value" required autoFocus type={step === 'email' ? 'email' : 'text'} inputMode={step === 'email' ? 'email' : 'numeric'} maxLength={step === 'code' ? 6 : undefined} value={step === 'email' ? email : code} onChange={(e) => step === 'email' ? setEmail(e.target.value) : setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={step === 'email' ? 'you@example.com' : '000000'} /><button className="primary-button mt-4 w-full" disabled={busy}>{busy ? 'Please wait…' : step === 'email' ? 'Send me a code' : 'Enter the collection'} <ChevronRight size={17} /></button>{step === 'code' && <button type="button" className="back-link mx-auto mt-4" onClick={() => setStep('email')}><ChevronLeft size={17} /> Use a different email</button>}{message && <p className="mt-4 text-sm text-coral" role="alert">{message}</p>}</form></main> }
function ProfileScreen({ onSave }: { onSave: (name: string) => Promise<void> }) { const [value, setValue] = useState(''); return <main className="auth-shell"><form className="auth-card" onSubmit={(e) => { e.preventDefault(); onSave(value) }}><span className="brand-mark"><Users size={19} /></span><p className="eyebrow mt-8">One last detail</p><h1 className="mt-3 text-3xl font-semibold">What should we call you?</h1><input className="auth-input mt-8" required autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Your name" /><button className="primary-button mt-4 w-full">Save my name <ChevronRight size={17} /></button></form></main> }



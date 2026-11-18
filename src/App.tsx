import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Crown, GraduationCap, Home, Medal, RefreshCw, Trophy, Volume2 } from 'lucide-react'
import { SAMPLE_CATEGORIES, SAMPLE_VOCABULARY, supabase, type Category, type QuizScore, type Vocabulary } from './lib/supabase'

type Page = 'home' | 'learn' | 'quiz' | 'leaderboard'
const GRADES = [1, 2, 3, 4, 5, 6]
const COLORS: Record<string, string> = { mint: 'bg-[#DDF5E9]', sunshine: 'bg-[#FFE7A3]', lavender: 'bg-[#E9E2FF]', coral: 'bg-[#FFE0D9]' }

function App() {
  const [page, setPage] = useState<Page>('home')
  const [categories, setCategories] = useState<Category[]>(SAMPLE_CATEGORIES)
  const [words, setWords] = useState<Vocabulary[]>(SAMPLE_VOCABULARY)
  const [categoryId, setCategoryId] = useState('')
  const [grade, setGrade] = useState(1)
  const [studentName, setStudentName] = useState('')
  const [currentWord, setCurrentWord] = useState(0)
  const [showMeaning, setShowMeaning] = useState(false)
  const [savedWords, setSavedWords] = useState<string[]>([])
  const [quizWords, setQuizWords] = useState<Vocabulary[]>([])
  const [quizIndex, setQuizIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answer, setAnswer] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const [scoreSaved, setScoreSaved] = useState(false)
  const [scores, setScores] = useState<QuizScore[]>([])
  const [dataError, setDataError] = useState('')
  const [scoreError, setScoreError] = useState('')
  const [loading, setLoading] = useState(true)
  const [speaking, setSpeaking] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function loadData() {
      if (!supabase) {
        setDataError('Supabase belum dikonfigurasi; kosakata contoh ditampilkan.')
        setLoading(false)
        return
      }
      try {
        // sort_order is defined by the schema but may not yet exist in an already-created project DB.
        // Do not select or order by it; category.name is present in the schema and is stable.
        const [categoryResult, vocabularyResult] = await Promise.all([
          supabase.from('categories').select('id, name, emoji, color, created_at').order('name', { ascending: true }),
          supabase.from('vocabulary').select('id, category_id, english, indonesian, pronunciation, example, emoji, created_at').order('english', { ascending: true }),
        ])
        if (!active) return
        if (categoryResult.error || vocabularyResult.error) {
          const detail = categoryResult.error
            ? `categories: ${categoryResult.error.message}`
            : `vocabulary: ${vocabularyResult.error?.message ?? 'Permintaan gagal.'}`
          setDataError(`Koneksi Supabase gagal: ${detail}. Kosakata contoh ditampilkan sementara.`)
          setCategories(SAMPLE_CATEGORIES)
          setWords(SAMPLE_VOCABULARY)
        } else {
          setCategories((categoryResult.data ?? []) as Category[])
          setWords((vocabularyResult.data ?? []) as Vocabulary[])
          setDataError('')
        }
      } catch (error) {
        if (!active) return
        const detail = error instanceof Error ? error.message : String(error)
        setDataError(`Koneksi Supabase gagal: ${detail}. Kosakata contoh ditampilkan sementara.`)
        setCategories(SAMPLE_CATEGORIES)
        setWords(SAMPLE_VOCABULARY)
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadData()
    return () => { active = false }
  }, [])

  const loadScores = async () => {
    if (!supabase) {
      setScores([])
      setScoreError('Papan skor online tidak tersedia karena Supabase belum dikonfigurasi.')
      return
    }
    const { data, error } = await supabase.from('quiz_scores')
      .select('id, player_name, score, total_questions, category_id, created_at')
      .order('score', { ascending: false }).order('created_at', { ascending: true }).limit(10)
    if (error) {
      setScoreError(`quiz_scores: ${error.message}`)
      return
    }
    setScores((data ?? []) as QuizScore[])
    setScoreError('')
  }

  useEffect(() => {
    void loadScores()
    if (!supabase) return
    const channel = supabase.channel('quiz-scores-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_scores' }, () => { void loadScores() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [])

  const visibleWords = useMemo(() => words.filter((item) => !categoryId || item.category_id === categoryId), [words, categoryId])
  const word = visibleWords.length ? visibleWords[currentWord % visibleWords.length] : undefined
  const quizWord = quizWords[quizIndex]
  const choices = useMemo(() => {
    if (!quizWord) return []
    const otherChoices = words.filter((item) => item.id !== quizWord.id && item.indonesian !== quizWord.indonesian)
      .sort(() => Math.random() - 0.5).slice(0, 3)
    return [...otherChoices, quizWord].sort((a, b) => a.indonesian.localeCompare(b.indonesian))
  }, [quizWord, words])
  const selectedCategory = categories.find((item) => item.id === categoryId) ?? null

  const speak = (text: string, id: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.85
    utterance.onstart = () => setSpeaking(id)
    utterance.onend = () => setSpeaking(null)
    utterance.onerror = () => setSpeaking(null)
    setSpeaking(id)
    window.speechSynthesis.speak(utterance)
  }

  const chooseCategory = (id: string) => {
    setCategoryId(id)
    setCurrentWord(0)
    setShowMeaning(false)
  }
  const startQuiz = () => {
    if (!studentName.trim()) {
      document.getElementById('student-name')?.focus()
      return
    }
    const pool = visibleWords.length ? visibleWords : words
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const count = Math.min(grade <= 3 ? 5 : 10, shuffled.length)
    setQuizWords(shuffled.slice(0, count))
    setQuizIndex(0)
    setScore(0)
    setAnswer(null)
    setFinished(false)
    setScoreSaved(false)
    setPage('quiz')
  }
  const chooseAnswer = (value: string) => {
    if (answer || !quizWord) return
    setAnswer(value)
    if (value === quizWord.indonesian) setScore((previous) => previous + 1)
  }
  const nextQuestion = () => {
    if (quizIndex + 1 < quizWords.length) {
      setQuizIndex((index) => index + 1)
      setAnswer(null)
      return
    }
    const finalScore = score + (answer === quizWord?.indonesian ? 1 : 0)
    setScore(finalScore)
    setFinished(true)
    if (!supabase) return
    void supabase.from('quiz_scores').insert({
      player_name: studentName.trim(),
      score: finalScore,
      total_questions: quizWords.length,
      category_id: categoryId || null,
    }).then(({ error }) => {
      if (error) {
        setScoreError(`quiz_scores insert: ${error.message}`)
        return
      }
      setScoreSaved(true)
      void loadScores()
    })
  }
  const navigate = (next: Page) => setPage(next)

  return <div className="min-h-screen bg-[#F6FBF8] pb-24 text-[#25334A] lg:pb-0">
    <div className="mx-auto flex min-h-screen max-w-7xl">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#E8EFEA] bg-white px-6 py-7 lg:flex">
        <button onClick={() => navigate('home')} className="mb-10 flex items-center gap-3 text-left"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#DDF5E9] text-2xl">🌱</span><span><b className="block text-xl font-black">KosaKata</b><small className="font-extrabold text-slate-400">BELAJAR JADI SERU!</small></span></button>
        <p className="mb-3 px-3 text-xs font-black uppercase tracking-widest text-slate-400">Menu belajar</p>
        <div className="space-y-2">
          <Nav active={page === 'home'} icon={<Home size={19}/>} label="Beranda" onClick={() => navigate('home')}/>
          <Nav active={page === 'learn'} icon={<BookOpen size={19}/>} label="Kartu kata" onClick={() => navigate('learn')}/>
          <Nav active={page === 'quiz'} icon={<CircleHelp size={19}/>} label="Kuis seru" onClick={startQuiz}/>
          <Nav active={page === 'leaderboard'} icon={<Trophy size={19}/>} label="Papan skor" onClick={() => navigate('leaderboard')}/>
        </div>
        <div className="mt-auto rounded-3xl bg-[#F0F8F3] p-5"><div className="mb-3 text-3xl">🚀</div><b>Terus semangat!</b><p className="mt-1 text-sm leading-6 text-slate-500">Sedikit belajar setiap hari bikin kamu makin hebat.</p></div>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-8 pt-5 sm:px-7 lg:px-10 lg:pt-8">
        <header className="mb-7 flex items-center justify-between"><button onClick={() => navigate('home')} className="font-black lg:hidden">🌱 KosaKata</button><div className="hidden sm:block"><p className="text-sm font-bold text-slate-400">Belajar bahasa Inggris</p><p className="mt-1 text-xl font-black">Hai, Sahabat Pintar! 👋</p></div><div className="ml-auto flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm"><GraduationCap size={18}/><span className="text-sm font-extrabold">Kelas {grade} SD</span></div></header>
        {dataError && <p role="status" className="mb-5 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-900">{dataError}</p>}
        {loading && <p className="mb-4 text-sm font-bold text-slate-500">Memuat kosakata…</p>}
        {page === 'home' && <HomePage categories={categories} categoryId={categoryId} grade={grade} name={studentName} setName={setStudentName} setGrade={setGrade} chooseCategory={chooseCategory} onLearn={() => navigate('learn')} onQuiz={startQuiz} onScores={() => navigate('leaderboard')}/>}
        {page === 'learn' && <LearnPage categories={categories} categoryId={categoryId} words={visibleWords} word={word} currentWord={currentWord} meaning={showMeaning} saved={word ? savedWords.includes(word.id) : false} chooseCategory={chooseCategory} flip={() => setShowMeaning((value) => !value)} next={() => { setCurrentWord((value) => value + 1); setShowMeaning(false) }} save={() => { if (!word) return; setSavedWords((items) => items.includes(word.id) ? items.filter((id) => id !== word.id) : [...items, word.id]) }} speak={speak} speaking={speaking}/>}
        {page === 'quiz' && <QuizPage word={quizWord} choices={choices} answer={answer} score={score} index={quizIndex} total={quizWords.length} finished={finished} name={studentName} saved={scoreSaved} category={selectedCategory} choose={chooseAnswer} next={nextQuestion} goHome={() => navigate('home')} goScores={() => navigate('leaderboard')} speak={speak} speaking={speaking}/>}
        {page === 'leaderboard' && <Leaderboard scores={scores} categories={categories} error={scoreError} refresh={() => { void loadScores() }}/>}
        <footer className="mt-12 flex items-center justify-center gap-2 text-xs font-bold text-slate-400">Belajar dengan gembira <span>✨</span></footer>
      </main>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-slate-100 bg-white/95 px-2 py-2 lg:hidden"><Mobile icon={<Home size={19}/>} label="Beranda" active={page === 'home'} click={() => navigate('home')}/><Mobile icon={<BookOpen size={19}/>} label="Kartu kata" active={page === 'learn'} click={() => navigate('learn')}/><Mobile icon={<CircleHelp size={19}/>} label="Kuis" active={page === 'quiz'} click={startQuiz}/><Mobile icon={<Trophy size={19}/>} label="Papan skor" active={page === 'leaderboard'} click={() => navigate('leaderboard')}/></nav>
  </div>
}

function Nav({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  const style = active ? 'bg-[#E7F6ED] text-[#318A60]' : 'text-slate-500 hover:bg-slate-50'
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-extrabold ${style}`}>{icon}{label}</button>
}
function Mobile({ icon, label, active, click }: { icon: ReactNode; label: string; active: boolean; click: () => void }) {
  const style = active ? 'text-[#318A60]' : 'text-slate-400'
  return <button onClick={click} className={`flex min-w-[68px] flex-col items-center gap-1 px-1 text-[10px] font-extrabold ${style}`}>{icon}{label}</button>
}
function Speaker({ text, id, speak, speaking }: { text: string; id: string; speak: (text: string, id: string) => void; speaking: string | null }) {
  const style = speaking === id ? 'animate-pulse bg-[#32875D] text-white' : 'bg-[#EAF7EF] text-[#32875D]'
  return <button type="button" aria-label={`Dengarkan ${text}`} onClick={(event) => { event.stopPropagation(); speak(text, id) }} className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${style}`}><Volume2 size={22}/></button>
}
function CategoryPicker({ categories, categoryId, choose }: { categories: Category[]; categoryId: string; choose: (id: string) => void }) {
  return <div className="flex flex-wrap gap-2"><button onClick={() => choose('')} className={`min-h-12 rounded-2xl px-4 font-extrabold ${!categoryId ? 'bg-[#32875D] text-white' : 'bg-white shadow-sm'}`}>Semua</button>{categories.map((category) => {
    const color = CATEGORY_COLORS[category.color] ?? 'bg-white'
    const style = category.id === categoryId ? 'bg-[#32875D] text-white' : `${color} text-[#25334A]`
    return <button key={category.id} onClick={() => choose(category.id)} className={`min-h-12 rounded-2xl px-4 font-extrabold ${style}`}>{category.emoji} {category.name}</button>
  })}</div>
}
function GradePicker({ grade, setGrade }: { grade: number; setGrade: (grade: number) => void }) {
  return <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{GRADES.map((item) => {
    const style = grade === item ? 'bg-[#32875D] text-white' : 'bg-white text-slate-600 shadow-sm'
    return <button key={item} onClick={() => setGrade(item)} className={`min-h-14 rounded-2xl font-black ${style}`}>Kelas {item}</button>
  })}</div>
}
function HomePage({ categories, categoryId, grade, name, setName, setGrade, chooseCategory, onLearn, onQuiz, onScores }: { categories: Category[]; categoryId: string; grade: number; name: string; setName: (name: string) => void; setGrade: (grade: number) => void; chooseCategory: (id: string) => void; onLearn: () => void; onQuiz: () => void; onScores: () => void }) {
  return <><section className="rounded-[30px] bg-[#DDF5E9] px-6 py-8 sm:px-10"><p className="font-black text-[#438765]">✨ WAKTUNYA BELAJAR!</p><h1 className="mt-4 text-4xl font-black sm:text-5xl">Yuk, tambah kosakata hari ini!</h1><p className="mt-3 font-semibold text-[#567665]">Belajar bahasa Inggris dengan cara seru.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={onLearn} className="min-h-12 rounded-2xl bg-[#32875D] px-5 font-extrabold text-white">Mulai belajar <ChevronRight className="inline" size={18}/></button><button onClick={onScores} className="min-h-12 rounded-2xl bg-white px-5 font-extrabold"><Trophy className="inline" size={18}/> Papan skor</button></div></section>
    <section className="mt-8 rounded-[28px] bg-white p-5 shadow-soft"><h2 className="mb-4 text-xl font-black">Nama siswa dan kelas</h2><label className="block font-bold">Nama<input id="student-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={50} placeholder="Contoh: Budi" className="mt-2 min-h-14 w-full rounded-2xl border-2 border-slate-100 px-4"/></label><p className="mb-2 mt-4 font-bold">Pilih kelas</p><GradePicker grade={grade} setGrade={setGrade}/></section>
    <section className="mt-8"><h2 className="mb-3 text-xl font-black">Pilih kategori</h2><CategoryPicker categories={categories} categoryId={categoryId} choose={chooseCategory}/></section>
    <button onClick={onQuiz} className="mt-8 rounded-2xl bg-[#FFF1D6] px-6 py-4 font-black">🧠 Mulai kuis seru</button>
  </>
}
function LearnPage({ categories, categoryId, words, word, currentWord, meaning, saved, chooseCategory, flip, next, save, speak, speaking }: { categories: Category[]; categoryId: string; words: Vocabulary[]; word?: Vocabulary; currentWord: number; meaning: boolean; saved: boolean; chooseCategory: (id: string) => void; flip: () => void; next: () => void; save: () => void; speak: (text: string, id: string) => void; speaking: string | null }) {
  const category = categories.find((item) => item.id === categoryId)
  return <section className="mx-auto max-w-3xl"><h1 className="mb-5 text-3xl font-black">Kartu kata</h1><div className="mb-5"><p className="mb-2 font-bold">Kategori</p><CategoryPicker categories={categories} categoryId={categoryId} choose={chooseCategory}/></div>{!word ? <p className="rounded-3xl bg-white p-8">Belum ada kosakata pada kategori ini.</p> : <><div className="mb-4 flex justify-between"><span className="rounded-full bg-white px-4 py-2 font-bold">{category?.emoji ?? '📚'} {category?.name ?? 'Semua kategori'}</span><span>{currentWord % words.length + 1} / {words.length}</span></div><div className="flex min-h-[350px] flex-col items-center justify-center rounded-[32px] bg-white p-8 text-center shadow-soft"><span className="text-7xl">{word.emoji}</span><h2 className="mt-5 text-4xl font-black">{meaning ? word.indonesian : word.english}</h2><p className="mt-2 text-slate-500">{meaning ? word.english : word.pronunciation}</p><div className="mt-5 flex gap-3"><Speaker text={word.english} id={`word-${word.id}`} speak={speak} speaking={speaking}/><button onClick={flip} className="rounded-2xl bg-[#EAF7EF] px-5 font-bold">{meaning ? 'Lihat kata' : 'Lihat arti'}</button></div><div className="mt-7 flex items-center gap-3 rounded-2xl bg-[#F7FAF8] p-4"><p className="font-bold">“{word.example}”</p><Speaker text={word.example} id={`example-${word.id}`} speak={speak} speaking={speaking}/></div></div><div className="mt-5 flex justify-center gap-3"><button onClick={save} className="rounded-2xl bg-white px-5 py-3 font-bold">{saved ? '♥ Tersimpan' : '♡ Simpan'}</button><button onClick={next} className="rounded-2xl bg-[#32875D] px-5 py-3 font-bold text-white">Berikutnya <ChevronRight className="inline"/></button></div></>}</section>
}
function QuizPage({ word, choices, answer, score, index, total, finished, name, saved, category, choose, next, goHome, goScores, speak, speaking }: { word?: Vocabulary; choices: Vocabulary[]; answer: string | null; score: number; index: number; total: number; finished: boolean; name: string; saved: boolean; category: Category | null; choose: (answer: string) => void; next: () => void; goHome: () => void; goScores: () => void; speak: (text: string, id: string) => void; speaking: string | null }) {
  if (finished) return <section className="mx-auto max-w-2xl rounded-[32px] bg-white p-10 text-center"><Trophy className="mx-auto text-amber-500" size={56}/><h1 className="mt-4 text-3xl font-black">Hebat, {name}!</h1><p className="mt-2 text-xl font-bold">Skor {score} dari {total}</p><p className="mt-3">{saved ? 'Skor tersimpan!' : 'Skor tidak dapat disimpan ke Supabase.'}</p><button onClick={goScores} className="mt-5 rounded-2xl bg-[#FFF1D6] px-5 py-3 font-bold">Lihat papan skor</button></section>
  if (!word || total === 0) return <section className="rounded-3xl bg-white p-8">Belum ada kata untuk kuis ini.</section>
  return <section className="mx-auto max-w-2xl"><div className="mb-5 flex justify-between"><h1 className="text-2xl font-black">Kuis seru, {name}!</h1><b>⭐ {score}</b></div><div className="rounded-[30px] bg-white p-6 shadow-soft"><div className="mb-5 flex justify-between"><b>Soal {index + 1} / {total}</b><span>{category?.name ?? 'Semua kategori'}</span></div><div className="mb-5 flex items-center justify-center gap-3 rounded-3xl bg-[#F7FAF8] p-6"><span className="text-5xl">{word.emoji}</span><b className="text-3xl">{word.english}</b><Speaker text={word.english} id={`quiz-${word.id}`} speak={speak} speaking={speaking}/></div><div className="grid gap-3 sm:grid-cols-2">{choices.map((item) => {
    const correct = item.indonesian === word.indonesian
    const style = answer ? (correct ? 'border-green-400 bg-green-50' : answer === item.indonesian ? 'border-rose-300 bg-rose-50' : 'border-slate-100') : 'border-slate-100 hover:border-green-300'
    return <button key={item.id} disabled={Boolean(answer)} onClick={() => choose(item.indonesian)} className={`min-h-14 rounded-2xl border-2 p-3 text-left font-bold ${style}`}>{item.indonesian}{answer && correct && <Check className="float-right"/>}</button>
  })}</div>{answer && <p className="mt-4 text-center font-bold">{answer === word.indonesian ? '🎉 Betul!' : `Jawaban: ${word.indonesian}`}</p>}<div className="mt-5 flex justify-between"><button onClick={goHome} className="font-bold text-slate-500"><ChevronLeft className="inline"/> Keluar</button><button disabled={!answer} onClick={next} className="rounded-2xl bg-[#32875D] px-5 py-3 font-bold text-white disabled:opacity-40">{index + 1 === total ? 'Selesai' : 'Berikutnya'} <ChevronRight className="inline"/></button></div></div></section>
}
function Leaderboard({ scores, categories, error, refresh }: { scores: QuizScore[]; categories: Category[]; error: string; refresh: () => void }) {
  const medals = [<Crown className="text-amber-500" key="first"/>, <Medal className="text-slate-400" key="second"/>, <Medal className="text-orange-500" key="third"/>]
  return <section className="mx-auto max-w-3xl"><div className="mb-5 flex items-center justify-between"><h1 className="text-3xl font-black">🏆 Papan Skor</h1><button onClick={refresh} className="rounded-xl bg-white p-3 font-bold"><RefreshCw className="inline" size={17}/> Perbarui</button></div>{error && <p role="status" className="mb-4 rounded-xl bg-amber-100 p-3 font-bold">{error}</p>}<div className="overflow-hidden rounded-3xl bg-white"><div className="grid grid-cols-[55px_1fr_auto] bg-[#DDF5E9] p-4 font-black"><span>#</span><span>Nama</span><span>Skor</span></div>{scores.length ? scores.map((item, index) => {
    const rank: ReactNode = index < 3 ? medals[index] : index + 1
    const category = categories.find((entry) => entry.id === item.category_id)
    return <div key={item.id ?? `${item.player_name}-${index}`} className="grid grid-cols-[55px_1fr_auto] items-center border-t p-4"><span>{rank}</span><b>{item.player_name}<small className="block text-slate-400">{category?.name ?? 'Semua kategori'}</small></b><b>{item.score}/{item.total_questions}</b></div>
  }) : <p className="p-8 text-center font-bold">Belum ada skor. Jadilah yang pertama!</p>}</div><p className="mt-3 text-xs text-slate-400">Papan skor diperbarui otomatis.</p></section>
}

export default App

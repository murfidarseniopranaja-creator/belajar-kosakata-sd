import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BookOpen, Check, CircleHelp, Home, Medal, RefreshCw, Sparkles, Trophy, Volume2 } from 'lucide-react'
import { SAMPLE_CATEGORIES, SAMPLE_VOCABULARY, supabase, type Category, type QuizScore, type Vocabulary } from './lib/supabase'

type Page = 'home' | 'learn' | 'quiz' | 'leaderboard'
const GRADES = [1, 2, 3, 4, 5, 6]
const COLORS: Record<string, string> = {
  mint: 'bg-[#DDF5E9]', sunshine: 'bg-[#FFE7A3]', lavender: 'bg-[#E9E2FF]', coral: 'bg-[#FFE0D9]',
}

function App() {
  const [page, setPage] = useState<Page>('home')
  const [categories, setCategories] = useState<Category[]>(SAMPLE_CATEGORIES)
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>(SAMPLE_VOCABULARY)
  const [scores, setScores] = useState<QuizScore[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [grade, setGrade] = useState(1)
  const [studentName, setStudentName] = useState('')
  const [wordIndex, setWordIndex] = useState(0)
  const [quizWords, setQuizWords] = useState<Vocabulary[]>([])
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizScore, setQuizScore] = useState(0)
  const [answer, setAnswer] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const [scoreSaved, setScoreSaved] = useState(false)
  const [speaking, setSpeaking] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    let mounted = true
    async function loadData() {
      if (!supabase) {
        setError('Supabase belum dikonfigurasi. Data contoh ditampilkan.')
        setLoading(false)
        return
      }
      try {
        const [categoryResult, vocabularyResult] = await Promise.all([
          supabase.from('categories')
            .select('id, name_en, name_id, icon_emoji, color_theme, sort_order')
            .order('sort_order', { ascending: true }),
          supabase.from('vocabularies')
            .select('id, category_id, grade_level, word_en, phonetic, word_id, example_en, example_id, image_emoji')
            .order('word_en', { ascending: true }),
        ])
        if (!mounted) return
        if (categoryResult.error || vocabularyResult.error) {
          setError(categoryResult.error?.message ?? vocabularyResult.error?.message ?? 'Permintaan Supabase gagal.')
        } else {
          const categoryRows = (categoryResult.data ?? []).map((row) => normalizeCategory(row))
          const wordRows = (vocabularyResult.data ?? []).map((row) => normalizeVocabulary(row))
          setCategories(categoryRows.length ? categoryRows : SAMPLE_CATEGORIES)
          setVocabularies(wordRows.length ? wordRows : SAMPLE_VOCABULARY)
          setError('')
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : String(loadError ?? ''))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void loadData()
    return () => { mounted = false }
  }, [])

  const loadScores = async () => {
    if (!supabase) return
    const { data, error: queryError } = await supabase.from('quiz_scores')
      .select('id, student_name, grade_level, category_name, score, total_questions, created_at')
      .order('score', { ascending: false }).limit(10)
    if (queryError) {
      setError(queryError.message)
      return
    }
    setScores((data ?? []).map((row) => normalizeScore(row)))
  }

  useEffect(() => {
    void loadScores()
    if (!supabase) return
    const channel = supabase.channel('quiz-scores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_scores' }, () => { void loadScores() })
      .subscribe()
    return () => { if (supabase) void supabase.removeChannel(channel) }
  }, [])

  const safeCategories = categories ?? []
  const safeWords = vocabularies ?? []
  const category = safeCategories.find((item) => (item?.id ?? '') === categoryId) ?? null
  const shownWords = useMemo(() => safeWords.filter((item) =>
    Number(item?.grade_level ?? grade) === grade && (!categoryId || (item?.category_id ?? '') === categoryId)),
  [safeWords, categoryId, grade])
  const word = shownWords.length ? shownWords[wordIndex % shownWords.length] : undefined
  const quizWord = quizWords?.[quizIndex]
  const choices = useMemo(() => {
    if (!quizWord) return []
    const alternatives = safeWords.filter((item) => item?.id !== quizWord.id && (item?.word_id ?? '') !== (quizWord.word_id ?? ''))
      .slice(0, 3)
    return [...alternatives, quizWord]
  }, [quizWord, safeWords])

  const speak = (text: string | null | undefined, id: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text ?? '')
    utterance.lang = 'en-US'
    utterance.rate = 0.85
    utterance.onstart = () => setSpeaking(id)
    utterance.onend = () => setSpeaking(null)
    utterance.onerror = () => setSpeaking(null)
    setSpeaking(id)
    window.speechSynthesis.speak(utterance)
  }

  const startQuiz = () => {
    if (!studentName.trim()) {
      document.getElementById('student-name')?.focus()
      return
    }
    const pool = shownWords.length ? shownWords : safeWords.filter((item) => Number(item?.grade_level ?? grade) === grade)
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const total = Math.min(grade <= 3 ? 5 : 10, shuffled.length)
    setQuizWords(shuffled.slice(0, total))
    setQuizIndex(0)
    setQuizScore(0)
    setAnswer(null)
    setFinished(false)
    setScoreSaved(false)
    setPage('quiz')
  }

  const selectAnswer = (value: string) => {
    if (answer || !quizWord) return
    const safeValue = value ?? ''
    setAnswer(safeValue)
    if (safeValue === (quizWord.word_id ?? '')) setQuizScore((current) => current + 1)
  }

  const nextQuestion = () => {
    if (quizIndex + 1 < quizWords.length) {
      setQuizIndex((current) => current + 1)
      setAnswer(null)
      return
    }
    const finalScore = quizScore + (answer === (quizWord?.word_id ?? '') ? 1 : 0)
    setQuizScore(finalScore)
    setFinished(true)
    if (!supabase) return
    void supabase.from('quiz_scores').insert([{
      student_name: studentName.trim() || 'Siswa',
      grade_level: grade,
      category_name: category?.name_id ?? category?.name_en ?? null,
      score: finalScore,
      total_questions: quizWords.length,
    }]).then(({ error: insertError }) => {
      if (insertError) {
        setError(insertError.message)
        return
      }
      setScoreSaved(true)
      void loadScores()
    })
  }

  return (
    <div className="min-h-screen bg-[#F6FBF8] pb-20 text-[#25334A]">
      <header className="mx-auto flex max-w-5xl items-center justify-between p-5">
        <button onClick={() => setPage('home')} className="flex items-center gap-2 text-xl font-black"><span>🌱</span>KosaKata</button>
        <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-bold"><BookOpen size={18}/> Kelas {grade}</span>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-8">
        {error && <p role="status" className="mb-4 rounded-2xl bg-amber-100 p-4 font-bold">{error}</p>}
        {loading && <p className="mb-4 font-bold">Memuat data…</p>}
        <nav className="mb-6 flex flex-wrap gap-2">
          <PageButton active={page === 'home'} onClick={() => setPage('home')} icon={<Home size={17}/>} label="Beranda" />
          <PageButton active={page === 'learn'} onClick={() => setPage('learn')} icon={<BookOpen size={17}/>} label="Kartu kata" />
          <PageButton active={page === 'quiz'} onClick={startQuiz} icon={<CircleHelp size={17}/>} label="Kuis" />
          <PageButton active={page === 'leaderboard'} onClick={() => { setPage('leaderboard'); void loadScores() }} icon={<Trophy size={17}/>} label="Papan skor" />
        </nav>

        {page === 'home' && <section className="space-y-7">
          <div className="rounded-[30px] bg-[#DDF5E9] p-7 sm:p-10">
            <p className="flex items-center gap-2 font-black text-[#32875D]"><Sparkles size={18}/> WAKTUNYA BELAJAR!</p>
            <h1 className="mt-3 text-4xl font-black">Yuk, belajar kosakata Inggris!</h1>
            <p className="mt-3 font-semibold">Baca, dengar, dan kuasai kata baru dengan cara seru.</p>
          </div>
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <label className="block font-extrabold">Nama siswa<input id="student-name" value={studentName ?? ''} onChange={(event) => setStudentName(event.target.value ?? '')} placeholder="Contoh: Budi" className="mt-2 block min-h-12 w-full rounded-xl border-2 border-slate-100 px-4"/></label>
            <p className="mb-2 mt-5 font-extrabold">Pilih kelas</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{GRADES.map((item) => <button key={item} onClick={() => setGrade(item)} className={`min-h-12 rounded-xl font-black ${grade === item ? 'bg-[#32875D] text-white' : 'bg-[#FFF1D6]'}`}>Kelas {item}</button>)}</div>
          </section>
          <section><h2 className="mb-3 text-xl font-black">Pilih kategori</h2><CategoryButtons categories={safeCategories} selected={categoryId} onSelect={setCategoryId}/></section>
          <button onClick={startQuiz} className="rounded-2xl bg-[#32875D] px-6 py-4 font-black text-white">Mulai kuis <ChevronRight className="inline"/></button>
        </section>}

        {page === 'learn' && <section>
          <h1 className="mb-4 text-3xl font-black">Kartu kata</h1>
          <CategoryButtons categories={safeCategories} selected={categoryId} onSelect={(id) => { setCategoryId(id); setWordIndex(0) }}/>
          {word ? <article className="mt-5 rounded-[30px] bg-white p-7 text-center shadow-sm">
            <span className="text-7xl">{word.image_emoji ?? ''}</span>
            <h2 className="mt-3 text-4xl font-black">{word.word_en ?? ''}</h2>
            <p className="mt-2 text-slate-500">{word.phonetic ?? ''}</p>
            <p className="mt-2 text-xl font-bold">{word.word_id ?? ''}</p>
            <div className="my-5 flex items-center justify-center gap-3"><SpeakButton text={word.word_en} id={`word-${word.id ?? ''}`} active={speaking} speak={speak}/><span className="font-bold">{word.example_en ?? ''}</span><SpeakButton text={word.example_en} id={`example-${word.id ?? ''}`} active={speaking} speak={speak}/></div>
            <p className="text-sm text-slate-500">{word.example_id ?? ''}</p>
            <button onClick={() => setWordIndex((index) => index + 1)} className="mt-5 rounded-xl bg-[#DDF5E9] px-5 py-3 font-extrabold">Kata berikutnya</button>
          </article> : <p className="mt-5 rounded-2xl bg-white p-6">Belum ada kata untuk kelas atau kategori ini.</p>}
        </section>}

        {page === 'quiz' && <section className="mx-auto max-w-2xl rounded-[30px] bg-white p-7 shadow-sm">
          {finished ? <div className="text-center"><Trophy size={54} className="mx-auto text-amber-500"/><h1 className="mt-4 text-3xl font-black">Hebat, {studentName || 'Siswa'}!</h1><p className="mt-2 text-xl font-bold">Skor {quizScore} / {quizWords.length}</p><p className="mt-2">{scoreSaved ? 'Skor tersimpan!' : 'Skor tersimpan jika Supabase terhubung.'}</p><button onClick={() => setPage('leaderboard')} className="mt-5 rounded-xl bg-[#FFF1D6] px-5 py-3 font-bold">Lihat papan skor</button></div>
            : quizWord ? <><div className="flex items-center justify-between"><h1 className="text-2xl font-black">Soal {quizIndex + 1} / {quizWords.length}</h1><span className="font-bold">⭐ {quizScore}</span></div><div className="my-6 flex items-center justify-center gap-4 rounded-2xl bg-[#F6FBF8] p-6"><span className="text-5xl">{quizWord.image_emoji ?? ''}</span><b className="text-3xl">{quizWord.word_en ?? ''}</b><SpeakButton text={quizWord.word_en} id={`quiz-${quizWord.id ?? ''}`} active={speaking} speak={speak}/></div><p className="mb-3 text-center font-bold">Pilih arti yang benar</p><div className="grid gap-3 sm:grid-cols-2">{choices.map((choice, index) => <button key={choice?.id ?? index} disabled={Boolean(answer)} onClick={() => selectAnswer(choice?.word_id ?? '')} className={`min-h-14 rounded-xl border-2 p-3 font-bold ${answer && choice?.word_id === quizWord.word_id ? 'border-green-400 bg-green-50' : 'border-slate-100'}`}>{choice?.word_id ?? ''}{answer && choice?.word_id === quizWord.word_id && <Check className="float-right"/>}</button>)}</div>{answer && <button onClick={nextQuestion} className="mt-5 w-full rounded-xl bg-[#32875D] p-3 font-bold text-white">{quizIndex + 1 === quizWords.length ? 'Selesai' : 'Soal berikutnya'}</button>}</>
              : <p>Belum ada kata untuk kuis ini.</p>}
        </section>}

        {page === 'leaderboard' && <section className="rounded-[30px] bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><h1 className="text-3xl font-black"><Trophy className="inline text-amber-500"/> Papan Skor</h1><button onClick={() => { void loadScores() }} className="rounded-xl bg-[#DDF5E9] p-3"><RefreshCw size={18}/></button></div>{(scores ?? []).map((row, index) => <div key={row?.id ?? index} className="flex items-center justify-between border-t py-4"><span className="flex items-center gap-3">{index < 3 ? <Medal className="text-amber-500"/> : index + 1}<b>{row?.student_name ?? 'Siswa'}</b><small>Kelas {row?.grade_level ?? ''} · {row?.category_name ?? ''}</small></span><b>{row?.score ?? 0}/{row?.total_questions ?? 0}</b></div>)}</section>}
      </main>
    </div>
  )
}

function normalizeCategory(row: Partial<Category> | null): Category {
  return { id: row?.id ?? '', name_en: row?.name_en ?? '', name_id: row?.name_id ?? '', icon_emoji: row?.icon_emoji ?? '', color_theme: row?.color_theme ?? '', sort_order: Number(row?.sort_order ?? 0) }
}
function normalizeVocabulary(row: Partial<Vocabulary> | null): Vocabulary {
  return { id: row?.id ?? '', category_id: row?.category_id ?? '', grade_level: Number(row?.grade_level ?? 1), word_en: row?.word_en ?? '', phonetic: row?.phonetic ?? '', word_id: row?.word_id ?? '', example_en: row?.example_en ?? '', example_id: row?.example_id ?? '', image_emoji: row?.image_emoji ?? '' }
}
function normalizeScore(row: Partial<QuizScore> | null): QuizScore {
  return { id: row?.id ?? undefined, student_name: row?.student_name ?? '', grade_level: Number(row?.grade_level ?? 1), category_name: row?.category_name ?? '', score: Number(row?.score ?? 0), total_questions: Number(row?.total_questions ?? 0), created_at: row?.created_at ?? undefined }
}
function PageButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button onClick={onClick} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-bold ${active ? 'bg-[#32875D] text-white' : 'bg-white text-slate-600'}`}>{icon}{label}</button>
}
function CategoryButtons({ categories, selected, onSelect }: { categories: Category[]; selected: string; onSelect: (id: string) => void }) {
  return <div className="flex flex-wrap gap-2"><button onClick={() => onSelect('')} className={`min-h-11 rounded-xl px-4 font-bold ${!selected ? 'bg-[#32875D] text-white' : 'bg-white'}`}>Semua</button>{(categories ?? []).map((category, index) => {
    const item = category ?? normalizeCategory(null)
    const name = item.name_id || item.name_en || ''
    const color = COLORS[item.color_theme ?? ''] ?? 'bg-white'
    return <button key={item.id || index} onClick={() => onSelect(item.id ?? '')} className={`min-h-11 rounded-xl px-4 font-bold ${selected === item.id ? 'bg-[#32875D] text-white' : color}`}>{item.icon_emoji ?? ''} {name}</button>
  })}</div>
}
function SpeakButton({ text, id, active, speak }: { text: string | null | undefined; id: string; active: string | null; speak: (text: string | null | undefined, id: string) => void }) {
  const isActive = active === id
  return <button type="button" aria-label={`Dengarkan ${text ?? ''}`} onClick={() => speak(text, id)} className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${isActive ? 'animate-pulse bg-[#32875D] text-white' : 'bg-[#DDF5E9] text-[#32875D]'}`}><Volume2 size={21}/></button>
}

export default App

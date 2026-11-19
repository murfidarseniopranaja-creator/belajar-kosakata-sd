import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Crown,
  GraduationCap,
  HelpCircle,
  Home,
  Medal,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  XCircle,
} from 'lucide-react'
import {
  SAMPLE_CATEGORIES,
  SAMPLE_VOCABULARY,
  supabase,
  type Category,
  type QuizScore,
  type Vocabulary,
} from './lib/supabase'

type Page = 'home' | 'learn' | 'quiz' | 'leaderboard'
type QuizMode = 'multiple-choice' | 'written' | 'mixed'
type QuestionMode = 'multiple-choice' | 'written'
type QuizQuestion = { word: Vocabulary; mode: QuestionMode; choices: Vocabulary[] }

const GRADES = [1, 2, 3, 4, 5, 6]
const COLORS: Record<string, string> = {
  mint: 'bg-[#DDF5E9]',
  sunshine: 'bg-[#FFE7A3]',
  lavender: 'bg-[#E9E2FF]',
  coral: 'bg-[#FFE0D9]',
}
const QUIZ_MODES: { value: QuizMode; label: string }[] = [
  { value: 'multiple-choice', label: 'Pilihan Ganda (50 Soal)' },
  { value: 'written', label: 'Tebak Gambar — Tulis Bahasa Inggris (50 Soal)' },
  { value: 'mixed', label: 'Campuran: Pilihan Ganda + Tulis Jawaban (50 Soal)' },
]

function normalizeCategory(row: Partial<Category> | null | undefined): Category {
  return {
    id: row?.id ?? '',
    name_en: row?.name_en ?? '',
    name_id: row?.name_id ?? '',
    icon_emoji: row?.icon_emoji ?? '',
    color_theme: row?.color_theme ?? '',
    sort_order: Number(row?.sort_order ?? 0),
  }
}

function normalizeVocabulary(row: Partial<Vocabulary> | null | undefined): Vocabulary {
  return {
    id: row?.id ?? '',
    category_id: row?.category_id ?? '',
    grade_level: Number(row?.grade_level ?? 1),
    word_en: row?.word_en ?? '',
    phonetic: row?.phonetic ?? '',
    word_id: row?.word_id ?? '',
    example_en: row?.example_en ?? '',
    example_id: row?.example_id ?? '',
    image_emoji: row?.image_emoji ?? '',
  }
}

function normalizeScore(row: Partial<QuizScore> | null | undefined): QuizScore {
  return {
    id: row?.id ?? undefined,
    student_name: row?.student_name ?? 'Siswa',
    grade_level: Number(row?.grade_level ?? 1),
    category_name: row?.category_name ?? '',
    score: Number(row?.score ?? 0),
    total_questions: Number(row?.total_questions ?? 0),
    created_at: row?.created_at ?? undefined,
  }
}

function shuffle<T,>(items: T[]): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function buildQuizQuestions(pool: Vocabulary[], allWords: Vocabulary[], mode: QuizMode): QuizQuestion[] {
  const examWords = shuffle(pool).slice(0, 50)
  return examWords.map((word, index) => {
    const questionMode: QuestionMode = mode === 'mixed'
      ? (index % 2 === 0 ? 'multiple-choice' : 'written')
      : mode
    const distractors = shuffle(allWords.filter((candidate) =>
      candidate?.id !== word.id && (candidate?.word_id ?? '').trim() !== (word.word_id ?? '').trim(),
    )).slice(0, 3)
    const choices = shuffle([word, ...distractors])
    return { word, mode: questionMode, choices }
  })
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
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [studyComplete, setStudyComplete] = useState(false)
  const [quizMode, setQuizMode] = useState<QuizMode>('multiple-choice')
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizScore, setQuizScore] = useState(0)
  const [answer, setAnswer] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null)
  const [finished, setFinished] = useState(false)
  const [scoreSaved, setScoreSaved] = useState(false)
  const [speaking, setSpeaking] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(supabase))
  const [scoresLoading, setScoresLoading] = useState(false)
  const [writtenAnswer, setWrittenAnswer] = useState('')
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const speechRunRef = useRef(0)

  const clearTimers = () => {
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current)
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    speechTimerRef.current = null
    advanceTimerRef.current = null
    countdownTimerRef.current = null
    setCountdown(null)
  }

  const cancelSpeech = () => {
    speechRunRef.current += 1
    clearTimers()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(null)
  }

  useEffect(() => {
    let mounted = true
    async function loadLearningData() {
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
          const vocabularyRows = (vocabularyResult.data ?? []).map((row) => normalizeVocabulary(row))
          setCategories(categoryRows.length ? categoryRows : SAMPLE_CATEGORIES)
          setVocabularies(vocabularyRows.length ? vocabularyRows : SAMPLE_VOCABULARY)
          setError('')
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : String(loadError ?? ''))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void loadLearningData()
    return () => { mounted = false }
  }, [])

  const loadScores = async () => {
    if (!supabase) {
      setScores([])
      setError('Supabase belum dikonfigurasi; papan skor online tidak tersedia.')
      return
    }
    setScoresLoading(true)
    try {
      const { data, error: queryError } = await supabase.from('quiz_scores')
        .select('*')
        .order('score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20)
      if (queryError) {
        setError(queryError.message)
        return
      }
      setScores((data ?? []).map((row) => normalizeScore(row)))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError ?? ''))
    } finally {
      setScoresLoading(false)
    }
  }

  useEffect(() => {
    void loadScores()
    if (!supabase) return
    const channel = supabase.channel('quiz-scores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_scores' }, () => { void loadScores() })
      .subscribe()
    return () => { if (supabase) void supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    cancelSpeech()
    return () => {
      speechRunRef.current += 1
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current)
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [page, categoryId, wordIndex])

  const safeCategories = categories ?? []
  const safeWords = vocabularies ?? []
  const category = safeCategories.find((item) => (item?.id ?? '') === categoryId) ?? null
  const visibleWords = useMemo(() => safeWords.filter((item) =>
    Number(item?.grade_level ?? grade) === grade && (!categoryId || (item?.category_id ?? '') === categoryId)),
  [safeWords, categoryId, grade])
  const word = visibleWords.length ? visibleWords[wordIndex] : undefined
  const quizQuestion = quizQuestions?.[quizIndex]
  const quizWord = quizQuestion?.word

  const speak = (text: string | null | undefined, id: string) => {
    cancelSpeech()
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const run = speechRunRef.current
    const spokenText = text ?? ''
    const utterance = new SpeechSynthesisUtterance(spokenText)
    utterance.lang = 'en-US'
    utterance.rate = 0.85
    let completed = false
    const beginAutoAdvance = () => {
      if (completed || speechRunRef.current !== run) return
      completed = true
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current)
      speechTimerRef.current = null
      setSpeaking(null)
      if (!autoAdvance || page !== 'learn') return
      setCountdown(2)
      countdownTimerRef.current = setInterval(() => {
        setCountdown((remaining) => remaining === null || remaining <= 1 ? 0 : remaining - 1)
      }, 1000)
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
        setCountdown(null)
        if (speechRunRef.current === run) advanceWord()
      }, 2000)
    }
    utterance.onstart = () => setSpeaking(id)
    utterance.onend = beginAutoAdvance
    utterance.onerror = beginAutoAdvance
    setSpeaking(id)
    window.speechSynthesis.speak(utterance)
    const fallbackDuration = Math.max(2500, (spokenText.length / 12) * 1000)
    speechTimerRef.current = setTimeout(beginAutoAdvance, fallbackDuration)
  }

  const advanceWord = () => {
    cancelSpeech()
    if (wordIndex + 1 >= visibleWords.length) {
      setStudyComplete(true)
      return
    }
    setWordIndex((index) => index + 1)
  }

  const startExam = () => {
    if (!studentName.trim()) {
      document.getElementById('exam-student-name')?.focus()
      setError('Silakan isi nama siswa sebelum memulai ujian.')
      return
    }
    const selectedPool = safeWords.filter((item) =>
      Number(item?.grade_level ?? 0) === grade && (!categoryId || (item?.category_id ?? '') === categoryId),
    )
    const selectedIds = new Set(selectedPool.map((item) => item.id))
    const extraPool = shuffle(safeWords.filter((item) => !selectedIds.has(item.id)))
    const examPool = [...shuffle(selectedPool), ...extraPool].slice(0, 50)
    const questions = buildQuizQuestions(examPool, safeWords, quizMode)
    if (!questions.length) {
      setError('Belum ada kosakata yang tersedia untuk ujian ini.')
      return
    }
    cancelSpeech()
    setQuizQuestions(questions)
    setQuizIndex(0)
    setQuizScore(0)
    setAnswer(null)
    setWrittenAnswer('')
    setSubmitted(false)
    setAnswerCorrect(null)
    setFinished(false)
    setScoreSaved(false)
    setQuizStarted(true)
    setError('')
  }

  const submitAnswer = (value: string) => {
    if (submitted || !quizWord) return
    const normalizedAnswer = (value ?? '').trim().toLowerCase()
    const correctAnswer = quizQuestion?.mode === 'written'
      ? (quizWord.word_en ?? '').trim().toLowerCase()
      : (quizWord.word_id ?? '').trim().toLowerCase()
    const correct = normalizedAnswer === correctAnswer
    setAnswer(value ?? '')
    setAnswerCorrect(correct)
    setSubmitted(true)
    if (correct) setQuizScore((current) => Math.min(current + 1, quizQuestions.length))
    if (quizQuestion?.mode === 'written' && quizWord.word_en) speak(quizWord.word_en, `exam-answer-${quizWord.id ?? ''}`)
  }

  const finishExam = async () => {
    const finalScore = Math.min(quizScore, quizQuestions.length)
    setQuizScore(finalScore)
    setFinished(true)
    setQuizStarted(false)
    if (!supabase) return
    const categoryName = category?.name_id ?? category?.name_en ?? 'Semua Kategori'
    const { error: insertError } = await supabase.from('quiz_scores').insert([{
      student_name: studentName.trim() || 'Siswa',
      grade_level: grade,
      category_name: categoryName,
      score: finalScore,
      total_questions: quizQuestions.length,
    }])
    if (insertError) {
      setError(`Gagal menyimpan skor: ${insertError.message}`)
      return
    }
    setScoreSaved(true)
    await loadScores()
  }

  const nextQuestion = () => {
    if (!submitted) return
    if (quizIndex + 1 >= quizQuestions.length) {
      void finishExam()
      return
    }
    setQuizIndex((current) => current + 1)
    setAnswer(null)
    setWrittenAnswer('')
    setSubmitted(false)
    setAnswerCorrect(null)
  }

  const goTo = (nextPage: Page) => {
    cancelSpeech()
    setPage(nextPage)
  }

  return (
    <div className="min-h-screen bg-[#F6FBF8] pb-20 text-[#25334A]">
      <header className="mx-auto flex max-w-5xl items-center justify-between p-5">
        <button onClick={() => goTo('home')} className="flex items-center gap-2 text-xl font-black"><span>🌱</span>KosaKata</button>
        <label className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-bold"><GraduationCap size={18}/><select aria-label="Kelas aktif" value={grade} onChange={(event) => setGrade(Number(event.target.value))} className="bg-transparent outline-none">{GRADES.map((item) => <option key={item} value={item}>Kelas {item} SD</option>)}</select></label>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-8">
        {error && <p role="status" className="mb-4 rounded-2xl bg-amber-100 p-4 font-bold">{error ?? ''}</p>}
        {loading && <p className="mb-4 font-bold">Memuat data…</p>}
        <nav className="mb-6 flex flex-wrap gap-2">
          <PageButton active={page === 'home'} onClick={() => goTo('home')} icon={<Home size={17}/>} label="Beranda" />
          <PageButton active={page === 'learn'} onClick={() => { setStudyComplete(false); goTo('learn') }} icon={<BookOpen size={17}/>} label="Kartu kata" />
          <PageButton active={page === 'quiz'} onClick={() => { setPage('quiz'); setQuizStarted(false) }} icon={<HelpCircle size={17}/>} label="Ujian" />
          <PageButton active={page === 'leaderboard'} onClick={() => { goTo('leaderboard'); void loadScores() }} icon={<Trophy size={17}/>} label="Papan skor" />
        </nav>

        {page === 'home' && <section className="space-y-7">
          <div className="rounded-[30px] bg-[#DDF5E9] p-7 sm:p-10"><p className="flex items-center gap-2 font-black text-[#32875D]"><Sparkles size={18}/> WAKTUNYA BELAJAR!</p><h1 className="mt-3 text-4xl font-black">Yuk, belajar kosakata Inggris!</h1><p className="mt-3 font-semibold">Baca, dengar, dan kuasai kata baru dengan cara seru.</p></div>
          <section className="rounded-3xl bg-white p-5 shadow-sm"><label className="block font-extrabold">Nama siswa<input id="exam-student-name" value={studentName ?? ''} onChange={(event) => setStudentName(event.target.value ?? '')} placeholder="Contoh: Budi" className="mt-2 block min-h-12 w-full rounded-xl border-2 border-slate-100 px-4"/></label><p className="mb-2 mt-5 font-extrabold">Pilih kelas</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{GRADES.map((item) => <button key={item} onClick={() => setGrade(item)} className={`min-h-12 rounded-xl font-black ${grade === item ? 'bg-[#32875D] text-white' : 'bg-[#FFF1D6]'}`}>Kelas {item} SD</button>)}</div></section>
          <section><h2 className="mb-3 text-xl font-black">Pilih kategori belajar</h2><CategoryButtons categories={safeCategories} selected={categoryId} onSelect={setCategoryId}/></section>
          <div className="flex flex-wrap gap-3"><button onClick={() => { setPage('learn'); setStudyComplete(false) }} className="rounded-2xl bg-white px-6 py-4 font-black">Belajar dengan kartu kata <BookOpen className="inline"/></button><button onClick={() => { setPage('quiz'); setQuizStarted(false) }} className="rounded-2xl bg-[#32875D] px-6 py-4 font-black text-white">Persiapan ujian <ArrowRight className="inline"/></button></div>
        </section>}

        {page === 'learn' && <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-black">Kartu kata</h1><label className="inline-flex cursor-pointer items-center gap-3 rounded-full bg-white px-4 py-3 text-sm font-extrabold shadow-sm"><input type="checkbox" checked={autoAdvance} onChange={(event) => { cancelSpeech(); setAutoAdvance(event.target.checked) }} className="h-5 w-5 accent-[#32875D]"/>Auto-lanjut</label></div><CategoryButtons categories={safeCategories} selected={categoryId} onSelect={(id) => { cancelSpeech(); setCategoryId(id); setWordIndex(0); setStudyComplete(false) }}/>
          {studyComplete ? <article className="mx-auto mt-6 max-w-2xl rounded-[30px] bg-white p-8 text-center shadow-sm"><div className="text-6xl">🎉</div><h2 className="mt-4 text-3xl font-black">Hebat! Kamu menyelesaikan daftar kata.</h2><p className="mt-2 font-semibold text-slate-500">Mau mengulang atau mencoba kuis?</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button onClick={restartWordList} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#FFF1D6] px-5 font-extrabold"><RotateCcw size={19}/> Ulangi Daftar Kata</button><button onClick={() => { setPage('quiz'); setQuizStarted(false) }} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#32875D] px-5 font-extrabold text-white">Lanjut ke Ujian <ArrowRight size={19}/></button></div></article>
            : word ? <article className="mx-auto mt-5 max-w-2xl rounded-[30px] bg-white p-7 text-center shadow-sm"><div className="mb-4 flex items-center justify-between text-sm font-bold text-slate-400"><span>{category?.name_id ?? category?.name_en ?? 'Semua kategori'} · Kelas {word.grade_level ?? ''}</span><span>Kata {wordIndex + 1} dari {visibleWords.length}</span></div><span className="text-7xl">{word.image_emoji ?? ''}</span><h2 className="mt-3 text-4xl font-black">{word.word_en ?? ''}</h2><p className="mt-2 text-slate-500">{word.phonetic ?? ''}</p><p className="mt-2 text-xl font-bold">{word.word_id ?? ''}</p><div className="my-5 rounded-2xl bg-[#F6FBF8] p-4"><div className="flex flex-wrap items-center justify-center gap-3"><SpeakButton text={word.word_en} id={`word-${word.id ?? ''}`} active={speaking} speak={speak}/><span className="font-bold">{word.example_en ?? ''}</span><SpeakButton text={word.example_en} id={`example-${word.id ?? ''}`} active={speaking} speak={speak}/></div>{Boolean(word.example_id) && <p className="mt-2 text-sm text-slate-500">{word.example_id ?? ''}</p>}</div>{countdown !== null && <p aria-live="polite" className="mb-3 text-sm font-extrabold text-[#32875D]">Otomatis lanjut dalam {countdown} detik...</p>}<div className="mt-5 flex flex-wrap justify-center gap-3"><button onClick={repeatWord} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#FFF1D6] px-6 font-extrabold"><RotateCcw size={19}/> Ulangi</button><button onClick={continueStudy} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#32875D] px-6 font-extrabold text-white">Lanjut <ArrowRight size={19}/></button></div></article>
              : <p className="mt-5 rounded-2xl bg-white p-6">Belum ada kata untuk kelas atau kategori ini.</p>}</section>}

        {page === 'quiz' && <section className="mx-auto max-w-2xl rounded-[30px] bg-white p-6 shadow-sm">
          {finished ? <div className="text-center"><Trophy size={54} className="mx-auto text-amber-500"/><h1 className="mt-4 text-3xl font-black">Hebat, {studentName || 'Siswa'}!</h1><p className="mt-2 text-xl font-bold">Skor {quizScore} / {quizQuestions.length}</p><p className="mt-2">{scoreSaved ? 'Skor tersimpan!' : 'Skor tersimpan jika Supabase terhubung.'}</p><button onClick={() => { setPage('leaderboard'); void loadScores() }} className="mt-5 rounded-xl bg-[#FFF1D6] px-5 py-3 font-bold">Lihat papan skor</button></div>
            : !quizStarted ? <div><p className="text-xs font-black uppercase tracking-widest text-[#32875D]">Persiapan ujian</p><h1 className="mb-5 mt-1 text-3xl font-black">Siap untuk tantangan?</h1><label className="mb-4 block font-extrabold">Nama siswa<input id="exam-student-name" value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Nama lengkap" className="mt-2 min-h-12 w-full rounded-xl border-2 border-slate-100 px-4" required/></label><div className="mb-4"><p className="mb-2 font-extrabold">Kelas</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{GRADES.map((item) => <button key={item} onClick={() => setGrade(item)} className={`min-h-11 rounded-xl text-sm font-bold ${grade === item ? 'bg-[#32875D] text-white' : 'bg-[#FFF1D6]'}`}>Kelas {item} SD</button>)}</div></div><label className="mb-4 block font-extrabold">Kategori kosakata<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border-2 border-slate-100 bg-white px-4"><option value="">Semua Kategori</option>{safeCategories.map((item) => <option key={item.id} value={item.id}>{item.name_id ?? item.name_en ?? ''}</option>)}</select></label><label className="block font-extrabold">Mode ujian<select value={quizMode} onChange={(event) => setQuizMode(event.target.value as QuizMode)} className="mt-2 min-h-12 w-full rounded-xl border-2 border-slate-100 bg-white px-4">{QUIZ_MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><p className="mt-3 text-sm text-slate-500">Ujian menggunakan hingga 50 kosakata unik yang tersedia, termasuk kosakata dari kelas lain jika diperlukan.</p><button onClick={startExam} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#32875D] px-5 font-black text-white">Mulai Ujian <ArrowRight size={19}/></button></div>
            : quizQuestion && quizWord ? <div><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-slate-400">Ujian {QUIZ_MODES.find((item) => item.value === quizMode)?.label}</p><h1 className="text-2xl font-black">Soal {quizIndex + 1} / {quizQuestions.length}</h1></div><span className="rounded-full bg-[#FFF1D6] px-4 py-2 font-extrabold">⭐ {quizScore}</span></div>{quizQuestion.mode === 'multiple-choice' ? <><div className="mb-5 flex items-center justify-center gap-4 rounded-2xl bg-[#F6FBF8] p-6"><span className="text-5xl">{quizWord.image_emoji ?? ''}</span><div className="text-center"><p className="text-sm font-bold text-slate-500">Apa arti kata ini?</p><b className="text-3xl">{quizWord.word_en ?? ''}</b></div><SpeakButton text={quizWord.word_en} id={`exam-${quizWord.id ?? ''}`} active={speaking} speak={speak}/></div><div className="grid gap-3 sm:grid-cols-2">{quizQuestion.choices.map((choice, index) => { const letter = String.fromCharCode(65 + index); const isCorrect = (choice?.word_id ?? '').trim().toLowerCase() === (quizWord.word_id ?? '').trim().toLowerCase(); const className = submitted && isCorrect ? 'border-green-400 bg-green-50' : submitted && answer === choice?.word_id ? 'border-rose-300 bg-rose-50' : 'border-slate-100 hover:border-green-300'; return <button key={choice?.id ?? index} disabled={submitted} onClick={() => submitAnswer(choice?.word_id ?? '')} className={`flex min-h-14 items-center gap-3 rounded-xl border-2 p-3 text-left font-bold ${className}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white font-black">{letter}</span>{choice?.word_id ?? ''}{submitted && isCorrect && <CheckCircle2 className="ml-auto text-green-600" size={19}/>}</button> })}</div></> : <div className="rounded-2xl bg-[#F6FBF8] p-6 text-center"><div className="text-8xl">{quizWord.image_emoji ?? ''}</div><p className="mt-3 text-xl font-extrabold">{quizWord.word_id ?? ''}</p><div className="mt-4 flex justify-center"><SpeakButton text={quizWord.word_en} id={`exam-written-${quizWord.id ?? ''}`} active={speaking} speak={speak}/></div><form onSubmit={(event) => { event.preventDefault(); submitAnswer(writtenAnswer) }} className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={writtenAnswer} onChange={(event) => setWrittenAnswer(event.target.value)} disabled={submitted} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Tulis kata bahasa Inggris" className="min-h-12 flex-1 rounded-xl border-2 border-slate-200 px-4 text-left"/><button type="submit" disabled={submitted || !writtenAnswer.trim()} className="min-h-12 rounded-xl bg-[#32875D] px-5 font-extrabold text-white disabled:opacity-40">Periksa Jawaban</button></form></div>}{submitted && <div role="status" className={`mt-4 flex items-center gap-2 rounded-xl p-4 font-bold ${answerCorrect ? 'bg-green-50 text-green-800' : 'bg-rose-50 text-rose-800'}`}>{answerCorrect ? <CheckCircle2 size={20}/> : <XCircle size={20}/>}<span>{answerCorrect ? 'Benar!' : `Salah. Ejaan yang benar: ${quizWord.word_en ?? ''}`}</span>{!answerCorrect && <button type="button" onClick={() => speak(quizWord.word_en, `feedback-${quizWord.id ?? ''}`)} className="ml-auto rounded-lg bg-white p-2" aria-label="Dengarkan jawaban yang benar"><Volume2 size={19}/></button>}</div>}{submitted && <button onClick={nextQuestion} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#32875D] px-5 font-extrabold text-white">{quizIndex + 1 === quizQuestions.length ? 'Lihat Hasil' : 'Soal Berikutnya'} <ArrowRight size={18}/></button>}</div>
              : <p>Belum ada kosakata yang tersedia untuk ujian ini.</p>}
        </section>}

        {page === 'leaderboard' && <section className="rounded-[30px] bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h1 className="text-3xl font-black"><Trophy className="inline text-amber-500"/> Papan Skor</h1><p className="mt-1 text-sm text-slate-500">20 hasil ujian terbaik</p></div><button onClick={() => { void loadScores() }} disabled={scoresLoading} className="inline-flex items-center gap-2 rounded-xl bg-[#DDF5E9] p-3 font-bold disabled:opacity-60"><RefreshCw className={scoresLoading ? 'animate-spin' : ''} size={18}/> Segarkan</button></div>{scoresLoading && <p className="mb-3 text-sm font-bold text-slate-500">Memuat papan skor…</p>}{(scores ?? []).length ? (scores ?? []).map((row, index) => <div key={row?.id ?? index} className="flex items-center justify-between gap-3 border-t py-4"><span className="flex items-center gap-3">{index === 0 ? <Crown className="text-amber-500"/> : index < 3 ? <Medal className="text-slate-400"/> : index + 1}<b>{row?.student_name ?? 'Siswa'}</b><small>Kelas {row?.grade_level ?? ''} · {row?.category_name ?? ''}</small></span><b>{row?.score ?? 0}/{row?.total_questions ?? 0}</b></div>) : !scoresLoading && <p className="py-8 text-center font-bold">Belum ada hasil ujian. Jadilah yang pertama!</p>}</section>}
      </main>
    </div>
  )
}

function PageButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  const className = active ? 'bg-[#32875D] text-white' : 'bg-white text-slate-600'
  return <button onClick={onClick} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-bold ${className}`}>{icon}{label}</button>
}

function CategoryButtons({ categories, selected, onSelect }: { categories: Category[]; selected: string; onSelect: (id: string) => void }) {
  const safeCategories = categories ?? []
  return <div className="flex flex-wrap gap-2"><button onClick={() => onSelect('')} className={`min-h-11 rounded-xl px-4 font-bold ${!selected ? 'bg-[#32875D] text-white' : 'bg-white'}`}>Semua</button>{safeCategories.map((category, index) => { const item = category ?? normalizeCategory(null); const name = item.name_id || item.name_en || ''; const color = COLORS[item.color_theme ?? ''] ?? 'bg-white'; const className = selected === item.id ? 'bg-[#32875D] text-white' : color; return <button key={item.id || index} onClick={() => onSelect(item.id ?? '')} className={`min-h-11 rounded-xl px-4 font-bold ${className}`}>{item.icon_emoji ?? ''} {name}</button> })}</div>
}

function SpeakButton({ text, id, active, speak }: { text: string | null | undefined; id: string; active: string | null; speak: (text: string | null | undefined, id: string) => void }) {
  const isActive = active === id
  const className = isActive ? 'animate-pulse bg-[#32875D] text-white' : 'bg-[#DDF5E9] text-[#32875D]'
  return <button type="button" aria-label={`Dengarkan ${text ?? ''}`} onClick={() => speak(text, id)} className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${className}`}><Volume2 size={21}/></button>
}

export default App

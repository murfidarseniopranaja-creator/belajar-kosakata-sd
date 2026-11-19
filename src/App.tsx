import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, CircleHelp, Crown,
  GraduationCap, HelpCircle, Home, Lightbulb, Medal, PenTool, RefreshCw, RotateCcw,
  Shuffle, Sparkles, Trophy, Volume2, XCircle,
} from 'lucide-react'
import { SAMPLE_CATEGORIES, SAMPLE_VOCABULARY, supabase, type Category, type QuizScore, type Vocabulary } from './lib/supabase'

type Page = 'home' | 'learn' | 'practice' | 'quiz' | 'leaderboard'
type QuizMode = 'multiple-choice' | 'written' | 'mixed'
type QuestionMode = 'multiple-choice' | 'written'
type QuizQuestion = { word: Vocabulary; mode: QuestionMode; choices: Vocabulary[] }

const GRADES = [1, 2, 3, 4, 5, 6]
const COLORS: Record<string, string> = { mint: 'bg-[#DDF5E9]', sunshine: 'bg-[#FFE7A3]', lavender: 'bg-[#E9E2FF]', coral: 'bg-[#FFE0D9]' }
const MODES: { value: QuizMode; label: string }[] = [
  { value: 'multiple-choice', label: 'Pilihan Ganda (50 Soal)' },
  { value: 'written', label: 'Tebak Gambar — Tulis Bahasa Inggris (50 Soal)' },
  { value: 'mixed', label: 'Campuran: Pilihan Ganda + Tulis Jawaban (50 Soal)' },
]

function shuffle<T,>(values: T[]): T[] {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function normalizeCategory(row: Partial<Category> | null | undefined): Category {
  return { id: row?.id ?? '', name_en: row?.name_en ?? '', name_id: row?.name_id ?? '', icon_emoji: row?.icon_emoji ?? '', color_theme: row?.color_theme ?? '', sort_order: Number(row?.sort_order ?? 0) }
}
function normalizeVocabulary(row: Partial<Vocabulary> | null | undefined): Vocabulary {
  return { id: row?.id ?? '', category_id: row?.category_id ?? '', grade_level: Number(row?.grade_level ?? 1), word_en: row?.word_en ?? '', phonetic: row?.phonetic ?? '', word_id: row?.word_id ?? '', example_en: row?.example_en ?? '', example_id: row?.example_id ?? '', image_emoji: row?.image_emoji ?? '' }
}
function normalizeScore(row: Partial<QuizScore> | null | undefined): QuizScore {
  return { id: row?.id ?? undefined, student_name: row?.student_name ?? 'Siswa', grade_level: Number(row?.grade_level ?? 1), category_name: row?.category_name ?? '', score: Number(row?.score ?? 0), total_questions: Number(row?.total_questions ?? 0), created_at: row?.created_at ?? undefined }
}
function makeQuestions(pool: Vocabulary[], allWords: Vocabulary[], mode: QuizMode): QuizQuestion[] {
  if (!allWords.length) return []
  const poolShuffled = shuffle(pool.length ? pool : allWords).slice(0, 50)
  while (poolShuffled.length < 50) poolShuffled.push(allWords[Math.floor(Math.random() * allWords.length)])
  return poolShuffled.map((word, index) => {
    const questionMode: QuestionMode = mode === 'mixed' ? (index % 2 === 0 ? 'multiple-choice' : 'written') : mode
    const wrong = shuffle(allWords.filter((candidate) => candidate?.id !== word.id && (candidate?.word_id ?? '').trim().toLowerCase() !== (word.word_id ?? '').trim().toLowerCase())).slice(0, 3)
    return { word, mode: questionMode, choices: shuffle([word, ...wrong]) }
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
  const [studyComplete, setStudyComplete] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [practiceGrade, setPracticeGrade] = useState<number | null>(null)
  const [practiceCategory, setPracticeCategory] = useState('')
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [practiceInput, setPracticeInput] = useState('')
  const [practiceChecked, setPracticeChecked] = useState(false)
  const [practiceCorrect, setPracticeCorrect] = useState<boolean | null>(null)
  const [hintVisible, setHintVisible] = useState(false)
  const [practicePool, setPracticePool] = useState<Vocabulary[]>([])
  const [practiceAdvanceTimer, setPracticeAdvanceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const practiceInputRef = useRef<HTMLInputElement>(null)
  const [quizMode, setQuizMode] = useState<QuizMode>('multiple-choice')
  const [quizStarted, setQuizStarted] = useState(false)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answer, setAnswer] = useState<string | null>(null)
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [scoreSaved, setScoreSaved] = useState(false)
  const [writtenAnswer, setWrittenAnswer] = useState('')
  const [speaking, setSpeaking] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(supabase))
  const [scoresLoading, setScoresLoading] = useState(false)
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const speechRun = useRef(0)

  const clearSpeechTimers = () => {
    if (speechTimer.current) clearTimeout(speechTimer.current)
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
    speechTimer.current = null
    advanceTimer.current = null
    countdownTimer.current = null
    setCountdown(null)
  }
  const cancelSpeech = () => {
    speechRun.current += 1
    clearSpeechTimers()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(null)
  }

  useEffect(() => {
    let mounted = true
    async function loadLearningData() {
      if (!supabase) { setError('Supabase belum dikonfigurasi. Data contoh ditampilkan.'); setLoading(false); return }
      try {
        const [categoryResult, vocabularyResult] = await Promise.all([
          supabase.from('categories').select('id, name_en, name_id, icon_emoji, color_theme, sort_order').order('sort_order', { ascending: true }),
          supabase.from('vocabularies').select('id, category_id, grade_level, word_en, phonetic, word_id, example_en, example_id, image_emoji').order('word_en', { ascending: true }),
        ])
        if (!mounted) return
        if (categoryResult.error || vocabularyResult.error) setError(categoryResult.error?.message ?? vocabularyResult.error?.message ?? 'Permintaan Supabase gagal.')
        else {
          const categoryRows = (categoryResult.data ?? []).map((row) => normalizeCategory(row))
          const wordRows = (vocabularyResult.data ?? []).map((row) => normalizeVocabulary(row))
          setCategories(categoryRows.length ? categoryRows : SAMPLE_CATEGORIES)
          setVocabularies(wordRows.length ? wordRows : SAMPLE_VOCABULARY)
          setError('')
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : String(loadError ?? ''))
      } finally { if (mounted) setLoading(false) }
    }
    void loadLearningData()
    return () => { mounted = false }
  }, [])

  const loadScores = async () => {
    if (!supabase) { setScores([]); setError('Supabase belum dikonfigurasi; papan skor online tidak tersedia.'); return }
    setScoresLoading(true)
    try {
      const { data, error: queryError } = await supabase.from('quiz_scores').select('*')
        .order('score', { ascending: false }).order('created_at', { ascending: false }).limit(20)
      if (queryError) { setError(queryError.message); return }
      setScores((data ?? []).map((row) => normalizeScore(row)))
      setError('')
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : String(loadError ?? '')) }
    finally { setScoresLoading(false) }
  }

  useEffect(() => {
    void loadScores()
    if (!supabase) return
    const subscription = supabase.channel('quiz-scores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_scores' }, () => { void loadScores() })
      .subscribe()
    return () => { if (supabase) void supabase.removeChannel(subscription) }
  }, [])

  useEffect(() => {
    cancelSpeech()
    return () => {
      speechRun.current += 1
      if (speechTimer.current) clearTimeout(speechTimer.current)
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
      if (countdownTimer.current) clearInterval(countdownTimer.current)
      if (practiceAdvanceTimer) clearTimeout(practiceAdvanceTimer)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [page, categoryId, wordIndex, practiceIndex])

  const safeCategories = categories ?? []
  const safeWords = vocabularies ?? []
  const category = safeCategories.find((item) => (item?.id ?? '') === categoryId) ?? null
  const visibleWords = useMemo(() => safeWords.filter((item) => Number(item?.grade_level ?? grade) === grade && (!categoryId || (item?.category_id ?? '') === categoryId)), [safeWords, categoryId, grade])
  const studyWord = visibleWords[wordIndex]
  const selectedPracticeGrade = practiceGrade
  const practiceWords = useMemo(() => safeWords.filter((item) => (selectedPracticeGrade === null || Number(item?.grade_level ?? 0) === selectedPracticeGrade) && (!practiceCategory || (item?.category_id ?? '') === practiceCategory)), [safeWords, selectedPracticeGrade, practiceCategory])
  const currentPracticeWord = practiceWords.length ? practiceWords[practiceIndex % practiceWords.length] : undefined
  const question = questions[questionIndex]
  const quizWord = question?.word

  const speakSequence = (parts: { text: string; lang: string; rate: number }[], onDone?: () => void) => {
    cancelSpeech()
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { onDone?.(); return }
    const run = speechRun.current
    let index = 0
    const sayNext = () => {
      if (speechRun.current !== run) return
      const part = parts[index]
      if (!part) { setSpeaking(null); onDone?.(); return }
      const utterance = new SpeechSynthesisUtterance(part.text ?? '')
      utterance.lang = part.lang
      utterance.rate = part.rate
      utterance.onstart = () => setSpeaking(`${run}-${index}`)
      utterance.onend = () => { index += 1; sayNext() }
      utterance.onerror = () => { index += 1; sayNext() }
      window.speechSynthesis.speak(utterance)
    }
    sayNext()
  }

  const speak = (text: string | null | undefined, id: string) => {
    cancelSpeech()
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const phrase = text ?? ''
    const run = speechRun.current
    const utterance = new SpeechSynthesisUtterance(phrase)
    utterance.lang = 'en-US'
    utterance.rate = 0.85
    let completed = false
    const onComplete = () => {
      if (completed || speechRun.current !== run) return
      completed = true
      if (speechTimer.current) clearTimeout(speechTimer.current)
      speechTimer.current = null
      setSpeaking(null)
      if (!autoAdvance || page !== 'learn') return
      setCountdown(2)
      countdownTimer.current = setInterval(() => setCountdown((value) => value === null || value <= 1 ? 0 : value - 1), 1000)
      advanceTimer.current = setTimeout(() => {
        if (countdownTimer.current) clearInterval(countdownTimer.current)
        countdownTimer.current = null
        advanceTimer.current = null
        setCountdown(null)
        if (speechRun.current === run) advanceWord()
      }, 2000)
    }
    utterance.onstart = () => setSpeaking(id)
    utterance.onend = onComplete
    utterance.onerror = onComplete
    setSpeaking(id)
    window.speechSynthesis.speak(utterance)
    speechTimer.current = setTimeout(onComplete, Math.max(2500, (phrase.length / 12) * 1000))
  }

  const advanceWord = () => {
    cancelSpeech()
    if (wordIndex + 1 >= visibleWords.length) { setStudyComplete(true); return }
    setWordIndex((value) => value + 1)
  }
  const nextPractice = () => {
    cancelSpeech()
    if (practiceAdvanceTimer) clearTimeout(practiceAdvanceTimer)
    setPracticeAdvanceTimer(null)
    setPracticeInput('')
    setPracticeChecked(false)
    setPracticeCorrect(null)
    setHintVisible(false)
    setPracticeIndex((index) => practiceWords.length ? (index + 1) % practiceWords.length : 0)
  }
  const checkPractice = () => {
    if (!currentPracticeWord || practiceChecked || !practiceInput.trim()) return
    if (practiceAdvanceTimer) clearTimeout(practiceAdvanceTimer)
    setPracticeAdvanceTimer(null)
    const correct = practiceInput.trim().toLowerCase() === (currentPracticeWord.word_en ?? '').trim().toLowerCase()
    setPracticeChecked(true)
    setPracticeCorrect(correct)
    const english = currentPracticeWord.word_en ?? ''
    const indonesian = currentPracticeWord.word_id ?? ''
    const phonetic = currentPracticeWord.phonetic ?? ''
    if (correct) {
      speakSequence([{ text: 'Hebat! Jawabanmu benar.', lang: 'id-ID', rate: 0.95 }, { text: english, lang: 'en-US', rate: 0.85 }], () => {
        const timer = setTimeout(nextPractice, 2500)
        setPracticeAdvanceTimer(timer)
      })
    } else {
      const spelled = english.toUpperCase().split('').join(', ')
      speakSequence([
        { text: `Belum tepat. Bahasa Inggrisnya ${indonesian} adalah ${english}, dieja ${spelled}`, lang: 'id-ID', rate: 0.95 },
        { text: english, lang: 'en-US', rate: 0.85 },
      ])
      setError(phonetic ? `Cara baca: ${phonetic}` : '')
    }
  }
  const startExam = () => {
    if (!studentName.trim()) { document.getElementById('exam-student-name')?.focus(); setError('Silakan isi nama siswa sebelum memulai ujian.'); return }
    const selected = safeWords.filter((item) => Number(item?.grade_level ?? 0) === grade && (!categoryId || (item?.category_id ?? '') === categoryId))
    const selectedIds = new Set(selected.map((item) => item?.id))
    const otherGrades = shuffle(safeWords.filter((item) => !selectedIds.has(item?.id)))
    const pool = shuffle([...shuffle(selected), ...otherGrades])
    while (pool.length > 0 && pool.length < 50) pool.push(safeWords[Math.floor(Math.random() * safeWords.length)])
    const built = makeQuestions(pool.slice(0, 50), safeWords, quizMode)
    if (!built.length) { setError('Belum ada kosakata yang tersedia untuk ujian ini.'); return }
    cancelSpeech()
    setQuestions(built); setQuestionIndex(0); setScore(0); setAnswer(null); setWrittenAnswer(''); setAnswerCorrect(null); setSubmitted(false); setFinished(false); setScoreSaved(false); setQuizStarted(true); setError('')
  }
  const submitAnswer = (value: string) => {
    if (submitted || !quizWord) return
    const expected = question?.mode === 'written' ? (quizWord.word_en ?? '') : (quizWord.word_id ?? '')
    const correct = (value ?? '').trim().toLowerCase() === expected.trim().toLowerCase()
    setAnswer(value ?? ''); setAnswerCorrect(correct); setSubmitted(true)
    if (correct) setScore((old) => Math.min(old + 1, questions.length))
    if (question?.mode === 'written' && quizWord.word_en) speak(quizWord.word_en, `exam-${quizWord.id ?? ''}`)
  }
  const finishExam = async () => {
    if (finished) return
    const finalScore = Math.min(score, questions.length)
    setScore(finalScore); setFinished(true); setQuizStarted(false)
    if (!supabase) return
    try {
      const { error: insertError } = await supabase.from('quiz_scores').insert([{ student_name: studentName.trim() || 'Siswa', grade_level: grade, category_name: category?.name_id ?? category?.name_en ?? 'Semua Kategori', score: finalScore, total_questions: questions.length }])
      if (insertError) { setError(`Gagal menyimpan skor: ${insertError.message}`); return }
      setScoreSaved(true); await loadScores()
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : String(saveError ?? 'Gagal menyimpan skor.')) }
  }
  const nextQuestion = () => {
    if (!submitted) return
    if (questionIndex + 1 >= questions.length) { void finishExam(); return }
    setQuestionIndex((index) => index + 1); setAnswer(null); setWrittenAnswer(''); setAnswerCorrect(null); setSubmitted(false)
  }
  const goTo = (target: Page) => { cancelSpeech(); setPage(target) }
  const selectCategory = (id: string) => { cancelSpeech(); setCategoryId(id); setWordIndex(0); setStudyComplete(false) }
  const shufflePractice = () => {
    cancelSpeech()
    setPracticePool(shuffle(practiceWords))
    setPracticeIndex(0); setPracticeInput(''); setPracticeChecked(false); setPracticeCorrect(null); setHintVisible(false)
  }
  const nextStudyPage = () => { cancelSpeech(); setPage('practice') }
  const currentPractice = practicePool.length ? practicePool[practiceIndex % practicePool.length] : currentPracticeWord

  return <div className="min-h-screen bg-[#F6FBF8] pb-20 text-[#25334A]">
    <header className="mx-auto flex max-w-5xl items-center justify-between p-5"><button onClick={() => goTo('home')} className="flex items-center gap-2 text-xl font-black"><span>🌱</span>KosaKata</button><label className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-bold"><GraduationCap size={18}/><select aria-label="Kelas aktif" value={grade} onChange={(event) => setGrade(Number(event.target.value))} className="bg-transparent outline-none">{GRADES.map((item) => <option key={item} value={item}>Kelas {item} SD</option>)}</select></label></header>
    <main className="mx-auto max-w-5xl px-4 pb-8">
      {error && <p role="status" className="mb-4 rounded-2xl bg-amber-100 p-4 font-bold">{error ?? ''}</p>}{loading && <p className="mb-4 font-bold">Memuat data…</p>}
      <nav className="mb-6 flex flex-wrap gap-2">
        <PageButton active={page === 'home'} onClick={() => goTo('home')} icon={<Home size={17}/>} label="Beranda"/>
        <PageButton active={page === 'learn'} onClick={() => { setStudyComplete(false); goTo('learn') }} icon={<BookOpen size={17}/>} label="Kartu kata"/>
        <PageButton active={page === 'practice'} onClick={() => goTo('practice')} icon={<PenTool size={17}/>} label="Latihan"/>
        <PageButton active={page === 'quiz'} onClick={() => { cancelSpeech(); setPage('quiz'); setQuizStarted(false) }} icon={<HelpCircle size={17}/>} label="Ujian"/>
        <PageButton active={page === 'leaderboard'} onClick={() => { goTo('leaderboard'); void loadScores() }} icon={<Trophy size={17}/>} label="Papan skor"/>
      </nav>

      {page === 'home' && <section className="space-y-7"><div className="rounded-[30px] bg-[#DDF5E9] p-7 sm:p-10"><p className="flex items-center gap-2 font-black text-[#32875D]"><Sparkles size={18}/> WAKTUNYA BELAJAR!</p><h1 className="mt-3 text-4xl font-black">Yuk, belajar kosakata Inggris!</h1><p className="mt-3 font-semibold">Baca, dengar, dan kuasai kata baru dengan cara seru.</p></div><section className="rounded-3xl bg-white p-5 shadow-sm"><label className="block font-extrabold">Nama siswa<input id="exam-student-name" value={studentName ?? ''} onChange={(event) => setStudentName(event.target.value ?? '')} placeholder="Contoh: Budi" className="mt-2 block min-h-12 w-full rounded-xl border-2 border-slate-100 px-4"/></label><p className="mb-2 mt-5 font-extrabold">Pilih kelas</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{GRADES.map((item) => <button key={item} onClick={() => setGrade(item)} className={`min-h-12 rounded-xl font-black ${grade === item ? 'bg-[#32875D] text-white' : 'bg-[#FFF1D6]'}`}>Kelas {item} SD</button>)}</div></section><section><h2 className="mb-3 text-xl font-black">Pilih kategori belajar</h2><CategoryButtons categories={safeCategories} selected={categoryId} onSelect={selectCategory}/></section><div className="flex flex-wrap gap-3"><button onClick={() => { setPage('learn'); setStudyComplete(false) }} className="rounded-2xl bg-white px-6 py-4 font-black">Belajar dengan kartu kata <BookOpen className="inline"/></button><button onClick={() => { setPage('quiz'); setQuizStarted(false) }} className="rounded-2xl bg-[#32875D] px-6 py-4 font-black text-white">Persiapan ujian <ArrowRight className="inline"/></button></div></section>}

      {page === 'learn' && <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-black">Kartu kata</h1><label className="inline-flex cursor-pointer items-center gap-3 rounded-full bg-white px-4 py-3 text-sm font-extrabold shadow-sm"><input type="checkbox" checked={autoAdvance} onChange={(event) => { cancelSpeech(); setAutoAdvance(event.target.checked) }} className="h-5 w-5 accent-[#32875D]"/>Auto-lanjut</label></div><CategoryButtons categories={safeCategories} selected={categoryId} onSelect={selectCategory}/>{studyComplete ? <article className="mx-auto mt-6 max-w-2xl rounded-[30px] bg-white p-8 text-center shadow-sm"><div className="text-6xl">🎉</div><h2 className="mt-4 text-3xl font-black">Hebat! Kamu menyelesaikan daftar kata.</h2><p className="mt-2 font-semibold text-slate-500">Mau mengulang atau mencoba kuis?</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button onClick={() => { cancelSpeech(); setStudyComplete(false); setWordIndex(0) }} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#FFF1D6] px-5 font-extrabold"><RotateCcw size={19}/> Ulangi Daftar Kata</button><button onClick={nextStudyPage} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#32875D] px-5 font-extrabold text-white">Lanjut ke Latihan <ArrowRight size={19}/></button></div></article> : studyWord ? <article className="mx-auto mt-5 max-w-2xl rounded-[30px] bg-white p-7 text-center shadow-sm"><div className="mb-4 flex items-center justify-between text-sm font-bold text-slate-400"><span>{category?.name_id ?? category?.name_en ?? 'Semua kategori'} · Kelas {studyWord.grade_level ?? ''}</span><span>Kata {wordIndex + 1} dari {visibleWords.length}</span></div><span className="text-7xl">{studyWord.image_emoji ?? ''}</span><h2 className="mt-3 text-4xl font-black">{studyWord.word_en ?? ''}</h2><p className="mt-2 text-slate-500">{studyWord.phonetic ?? ''}</p><p className="mt-2 text-xl font-bold">{studyWord.word_id ?? ''}</p><div className="my-5 rounded-2xl bg-[#F6FBF8] p-4"><div className="flex flex-wrap items-center justify-center gap-3"><SpeakButton text={studyWord.word_en} id={`word-${studyWord.id ?? ''}`} active={speaking} speak={speak}/><span className="font-bold">{studyWord.example_en ?? ''}</span><SpeakButton text={studyWord.example_en} id={`example-${studyWord.id ?? ''}`} active={speaking} speak={speak}/></div>{Boolean(studyWord.example_id) && <p className="mt-2 text-sm text-slate-500">{studyWord.example_id ?? ''}</p>}</div>{countdown !== null && <p aria-live="polite" className="mb-3 text-sm font-extrabold text-[#32875D]">Otomatis lanjut dalam {countdown} detik...</p>}<div className="mt-5 flex flex-wrap justify-center gap-3"><button onClick={() => speak(studyWord.word_en, `word-${studyWord.id ?? ''}`)} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#FFF1D6] px-6 font-extrabold"><RotateCcw size={19}/> Ulangi</button><button onClick={advanceWord} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#32875D] px-6 font-extrabold text-white">Lanjut <ArrowRight size={19}/></button></div></article> : <p className="mt-5 rounded-2xl bg-white p-6">Belum ada kata untuk kelas atau kategori ini.</p>}</section>}

      {page === 'practice' && <PracticePage categories={safeCategories} words={safeWords} grade={grade} selectedCategory={practiceCategory} setSelectedCategory={setPracticeCategory} practiceGrade={practiceGrade} setPracticeGrade={setPracticeGrade} pool={practicePool} setPool={setPracticePool} index={practiceIndex} setIndex={setPracticeIndex} word={currentPractice} input={practiceInput} setInput={setPracticeInput} checked={practiceChecked} setChecked={setPracticeChecked} correct={practiceCorrect} setCorrect={setPracticeCorrect} hint={hintVisible} setHint={setHintVisible} inputRef={practiceInputRef} speaking={speaking} speak={speak} speakSequence={speakSequence} advanceTimer={practiceAdvanceTimer} setAdvanceTimer={setPracticeAdvanceTimer} cancelSpeech={cancelSpeech}/>}

      {page === 'quiz' && <section className="mx-auto max-w-2xl rounded-[30px] bg-white p-6 shadow-sm">{finished ? <div className="text-center"><Trophy size={54} className="mx-auto text-amber-500"/><h1 className="mt-4 text-3xl font-black">Hebat, {studentName || 'Siswa'}!</h1><p className="mt-2 text-xl font-bold">Skor {score} / {questions.length}</p><p className="mt-2">{scoreSaved ? 'Skor tersimpan!' : 'Skor tersimpan jika Supabase terhubung.'}</p><button onClick={() => { goTo('leaderboard'); void loadScores() }} className="mt-5 rounded-xl bg-[#FFF1D6] px-5 py-3 font-bold">Lihat papan skor</button></div> : !quizStarted ? <div><p className="text-xs font-black uppercase tracking-widest text-[#32875D]">Persiapan ujian</p><h1 className="mb-5 mt-1 text-3xl font-black">Siap untuk tantangan?</h1><label className="mb-4 block font-extrabold">Nama siswa<input id="exam-student-name" value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Nama lengkap" className="mt-2 min-h-12 w-full rounded-xl border-2 border-slate-100 px-4" required/></label><div className="mb-4"><p className="mb-2 font-extrabold">Kelas</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{GRADES.map((item) => <button key={item} onClick={() => setGrade(item)} className={`min-h-11 rounded-xl text-sm font-bold ${grade === item ? 'bg-[#32875D] text-white' : 'bg-[#FFF1D6]'}`}>Kelas {item} SD</button>)}</div></div><label className="mb-4 block font-extrabold">Kategori kosakata<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border-2 border-slate-100 bg-white px-4"><option value="">Semua Kategori</option>{safeCategories.map((item) => <option key={item.id} value={item.id}>{item.name_id ?? item.name_en ?? ''}</option>)}</select></label><label className="block font-extrabold">Mode ujian<select value={quizMode} onChange={(event) => setQuizMode(event.target.value as QuizMode)} className="mt-2 min-h-12 w-full rounded-xl border-2 border-slate-100 bg-white px-4">{MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><p className="mt-3 text-sm text-slate-500">50 soal acak, diisi dari kosakata kelas lain bila diperlukan.</p><button onClick={startExam} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#32875D] px-5 font-black text-white">Mulai Ujian <ArrowRight size={19}/></button></div> : question && quizWord ? <ExamQuestion question={question} index={questionIndex} total={questions.length} score={score} answer={answer} submitted={submitted} correct={answerCorrect} writtenAnswer={writtenAnswer} setWrittenAnswer={setWrittenAnswer} submitAnswer={submitAnswer} next={nextQuestion} speak={speak} speaking={speaking} /> : <p>Belum ada kosakata yang tersedia untuk ujian ini.</p>}</section>}

      {page === 'leaderboard' && <section className="rounded-[30px] bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h1 className="text-3xl font-black"><Trophy className="inline text-amber-500"/> Papan Skor</h1><p className="mt-1 text-sm text-slate-500">20 hasil ujian terbaik</p></div><button onClick={() => { void loadScores() }} disabled={scoresLoading} className="inline-flex items-center gap-2 rounded-xl bg-[#DDF5E9] p-3 font-bold disabled:opacity-60"><RefreshCw className={scoresLoading ? 'animate-spin' : ''} size={18}/> Segarkan</button></div>{scoresLoading && <p className="mb-3 text-sm font-bold text-slate-500">Memuat papan skor…</p>}{scores.length ? scores.map((row, index) => <div key={row?.id ?? index} className="flex items-center justify-between gap-3 border-t py-4"><span className="flex items-center gap-3">{index === 0 ? <Crown className="text-amber-500"/> : index < 3 ? <Medal className="text-slate-400"/> : index + 1}<b>{row?.student_name ?? 'Siswa'}</b><small>Kelas {row?.grade_level ?? ''} · {row?.category_name ?? ''}</small></span><b>{row?.score ?? 0}/{row?.total_questions ?? 0}</b></div>) : !scoresLoading && <p className="py-8 text-center font-bold">Belum ada hasil ujian. Jadilah yang pertama!</p>}</section>}
    </main>
  </div>
}

function PracticePage({ categories, words, grade, selectedCategory, setSelectedCategory, practiceGrade, setPracticeGrade, pool, setPool, index, setIndex, word, input, setInput, checked, setChecked, correct, setCorrect, hint, setHint, inputRef, speaking, speak, speakSequence, advanceTimer, setAdvanceTimer, cancelSpeech }: {
  categories: Category[]; words: Vocabulary[]; grade: number; selectedCategory: string; setSelectedCategory: (id: string) => void; practiceGrade: number | null; setPracticeGrade: (grade: number | null) => void; pool: Vocabulary[]; setPool: (words: Vocabulary[]) => void; index: number; setIndex: (index: number) => void; word?: Vocabulary; input: string; setInput: (text: string) => void; checked: boolean; setChecked: (value: boolean) => void; correct: boolean | null; setCorrect: (value: boolean | null) => void; hint: boolean; setHint: (value: boolean) => void; inputRef: React.RefObject<HTMLInputElement>; speaking: string | null; speak: (text: string | null | undefined, id: string) => void; speakSequence: (parts: { text: string; lang: string; rate: number }[], done?: () => void) => void; advanceTimer: ReturnType<typeof setTimeout> | null; setAdvanceTimer: (timer: ReturnType<typeof setTimeout> | null) => void; cancelSpeech: () => void
}) {
  const filtered = (words ?? []).filter((item) => (practiceGrade === null || Number(item?.grade_level ?? 0) === practiceGrade) && (!selectedCategory || (item?.category_id ?? '') === selectedCategory))
  const exerciseWords = pool.length ? pool : filtered
  const current = exerciseWords.length ? exerciseWords[index % exerciseWords.length] : word
  const english = current?.word_en ?? ''
  const indonesian = current?.word_id ?? ''
  const firstLetter = english ? english[0].toUpperCase() : ''
  const letterHint = english ? `${firstLetter} ${Array.from({ length: Math.max(english.length - 1, 0) }, () => '_').join(' ')} (${english.length} huruf)` : ''

  const reshuffle = () => {
    cancelSpeech()
    if (advanceTimer) clearTimeout(advanceTimer)
    setAdvanceTimer(null)
    const shuffled = shuffle(filtered)
    setPool(shuffled)
    setIndex(0)
    setInput('')
    setChecked(false)
    setCorrect(null)
    setHint(false)
  }
  const nextPracticeQuestion = () => {
    cancelSpeech()
    if (advanceTimer) clearTimeout(advanceTimer)
    setAdvanceTimer(null)
    setInput('')
    setChecked(false)
    setCorrect(null)
    setHint(false)
    setIndex(exerciseWords.length ? (index + 1) % exerciseWords.length : 0)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }
  const retry = () => {
    if (advanceTimer) clearTimeout(advanceTimer)
    setAdvanceTimer(null)
    setInput('')
    setChecked(false)
    setCorrect(null)
    setHint(false)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }
  const check = () => {
    if (!current || checked || !input.trim()) return
    if (advanceTimer) clearTimeout(advanceTimer)
    setAdvanceTimer(null)
    cancelSpeech()
    const isRight = input.trim().toLowerCase() === (current.word_en ?? '').trim().toLowerCase()
    setChecked(true)
    setCorrect(isRight)
    const rightWord = current.word_en ?? ''
    const meaning = current.word_id ?? ''
    const phonetic = current.phonetic ?? ''
    if (isRight) {
      speakSequence([{ text: 'Hebat! Jawabanmu benar.', lang: 'id-ID', rate: 0.95 }, { text: rightWord, lang: 'en-US', rate: 0.85 }], () => {
        const timer = setTimeout(nextPracticeQuestion, 2500)
        setAdvanceTimer(timer)
      })
    } else {
      const spelled = rightWord.toUpperCase().split('').join(', ')
      const feedback = `Belum tepat. Bahasa Inggrisnya ${meaning} adalah ${rightWord}, dieja ${spelled}`
      speakSequence([{ text: feedback, lang: 'id-ID', rate: 0.95 }, { text: rightWord, lang: 'en-US', rate: 0.85 }])
      setHint(false)
      if (phonetic) setTimeout(() => setCorrect(false), 0)
    }
  }

  return <section className="mx-auto max-w-3xl">
    <div className="mb-5"><p className="text-xs font-black uppercase tracking-widest text-[#32875D]">Latihan Menulis Bahasa Inggris</p><h1 className="mt-1 text-3xl font-black">Latihan</h1><p className="mt-1 text-sm font-semibold text-slate-500">Berlatih bebas, hasilnya tidak disimpan ke papan skor.</p></div>
    <div className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto]">
      <label className="font-extrabold">Kelas<select value={practiceGrade ?? ''} onChange={(event) => { cancelSpeech(); setPracticeGrade(event.target.value ? Number(event.target.value) : null); setPool([]); setIndex(0); retry() }} className="mt-2 min-h-12 w-full rounded-xl border-2 border-slate-100 bg-white px-3"><option value="">Semua Kelas</option>{GRADES.map((item) => <option key={item} value={item}>Kelas {item} SD</option>)}</select></label>
      <label className="font-extrabold">Kategori<select value={selectedCategory} onChange={(event) => { cancelSpeech(); setSelectedCategory(event.target.value); setPool([]); setIndex(0); retry() }} className="mt-2 min-h-12 w-full rounded-xl border-2 border-slate-100 bg-white px-3"><option value="">Semua Kategori</option>{(categories ?? []).map((item, i) => <option key={item?.id ?? i} value={item?.id ?? ''}>{item?.name_id ?? item?.name_en ?? ''}</option>)}</select></label>
      <button onClick={reshuffle} className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#32875D] px-4 font-extrabold text-white"><Shuffle size={18}/> Acak Soal</button>
    </div>
    {!current ? <div className="rounded-3xl bg-white p-8 text-center font-bold">Belum ada kata untuk filter ini.</div> : <article className="rounded-[30px] bg-white p-6 text-center shadow-sm sm:p-9">
      <div className="mb-4 flex items-center justify-between text-sm font-bold text-slate-400"><span>Soal {index + 1} dari {exerciseWords.length}</span><span>{practiceGrade === null ? `Kelas aktif ${grade}` : `Kelas ${practiceGrade} SD`}</span></div>
      <div className="text-[110px] leading-none sm:text-[140px]">{current.image_emoji ?? ''}</div>
      <p className="mt-4 text-2xl font-black">{indonesian}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3"><button onClick={() => setHint(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FFF1D6] px-4 font-extrabold"><Lightbulb size={18}/> Petunjuk Huruf</button><SpeakButton text={english} id={`practice-${current.id ?? ''}`} active={speaking} speak={speak}/></div>
      {hint && <p className="mt-3 font-mono text-lg font-black tracking-widest text-[#32875D]">{letterHint}</p>}
      <form onSubmit={(event) => { event.preventDefault(); check() }} className="mx-auto mt-6 flex max-w-xl flex-col gap-3 sm:flex-row"><input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} disabled={checked} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Ketik kata bahasa Inggris di sini" className="min-h-14 flex-1 rounded-2xl border-2 border-slate-200 px-4 text-lg outline-none focus:border-[#61C897]"/><button type="submit" disabled={checked || !input.trim()} className="min-h-14 rounded-2xl bg-[#32875D] px-5 font-extrabold text-white disabled:opacity-40">Periksa Jawaban</button></form>
      {checked && (correct ? <div className="mt-5 rounded-2xl border-2 border-green-200 bg-green-50 p-5 text-left"><p className="flex items-center gap-2 text-lg font-black text-green-800"><CheckCircle2/> Hebat! Jawabanmu Benar!</p><p className="mt-2 font-bold text-green-800">{english}</p><button onClick={() => speakSequence([{ text: 'Hebat! Jawabanmu benar.', lang: 'id-ID', rate: 0.95 }, { text: english, lang: 'en-US', rate: 0.85 }])} className="mt-3 rounded-xl bg-white p-2 text-green-700" aria-label="Dengarkan pujian"><Volume2/></button><button onClick={nextPracticeQuestion} className="ml-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#32875D] px-4 font-bold text-white">Soal Berikutnya <ArrowRight size={18}/></button><span className="ml-3 text-xs text-green-700">Berikutnya otomatis dalam 2,5 detik</span></div> : <div className="mt-5 rounded-2xl border-2 border-orange-200 bg-orange-50 p-5 text-left"><p className="font-bold text-rose-700">Jawabanmu: <s>{input}</s></p><p className="mt-2 text-3xl font-black text-green-700">{english}</p><p className="mt-2 font-mono font-bold tracking-wide">{english.toUpperCase().split('').join(' - ')}</p>{Boolean(current.phonetic) && <p className="mt-1 text-sm text-slate-600">Cara baca: {current.phonetic ?? ''}</p>}<p className="mt-2 text-sm text-slate-600">Arti: {indonesian}</p><div className="mt-4 flex flex-wrap gap-3"><button onClick={retry} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FFF1D6] px-4 font-extrabold"><RotateCcw size={18}/> Tulis Ulang Jawaban</button><button onClick={nextPracticeQuestion} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#32875D] px-4 font-extrabold text-white">Soal Berikutnya <ArrowRight size={18}/></button></div></div>)}
    </article>}
  </section>
}

function ExamQuestion({ question, index, total, score, answer, submitted, correct, writtenAnswer, setWrittenAnswer, submitAnswer, next, speak, speaking }: { question: QuizQuestion; index: number; total: number; score: number; answer: string | null; submitted: boolean; correct: boolean | null; writtenAnswer: string; setWrittenAnswer: (value: string) => void; submitAnswer: (value: string) => void; next: () => void; speak: (text: string | null | undefined, id: string) => void; speaking: string | null }) {
  const word = question.word
  return <div><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-slate-400">Soal ujian</p><h1 className="text-2xl font-black">Soal {index + 1} / {total}</h1></div><span className="rounded-full bg-[#FFF1D6] px-4 py-2 font-extrabold">⭐ {score}</span></div>
    {question.mode === 'multiple-choice' ? <><div className="mb-5 flex items-center justify-center gap-4 rounded-2xl bg-[#F6FBF8] p-6"><span className="text-5xl">{word.image_emoji ?? ''}</span><div className="text-center"><p className="text-sm font-bold text-slate-500">Apa arti kata ini?</p><b className="text-3xl">{word.word_en ?? ''}</b></div><SpeakButton text={word.word_en} id={`exam-${word.id ?? ''}`} active={speaking} speak={speak}/></div><div className="grid gap-3 sm:grid-cols-2">{question.choices.map((choice, optionIndex) => { const letter = String.fromCharCode(65 + optionIndex); const isCorrect = (choice?.word_id ?? '').trim().toLowerCase() === (word.word_id ?? '').trim().toLowerCase(); const color = submitted && isCorrect ? 'border-green-400 bg-green-50' : submitted && answer === choice?.word_id ? 'border-rose-300 bg-rose-50' : 'border-slate-100'; return <button key={`${index}-${choice?.id ?? optionIndex}`} disabled={submitted} onClick={() => submitAnswer(choice?.word_id ?? '')} className={`flex min-h-14 items-center gap-3 rounded-xl border-2 p-3 text-left font-bold ${color}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white font-black">{letter}</span>{choice?.word_id ?? ''}{submitted && isCorrect && <CheckCircle2 className="ml-auto text-green-600" size={19}/>}</button> })}</div></> : <div className="rounded-2xl bg-[#F6FBF8] p-6 text-center"><div className="text-8xl">{word.image_emoji ?? ''}</div><p className="mt-3 text-xl font-extrabold">{word.word_id ?? ''}</p><div className="mt-4 flex justify-center"><SpeakButton text={word.word_en} id={`exam-written-${word.id ?? ''}`} active={speaking} speak={speak}/></div><form onSubmit={(event) => { event.preventDefault(); submitAnswer(writtenAnswer) }} className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={writtenAnswer} onChange={(event) => setWrittenAnswer(event.target.value)} disabled={submitted} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Tulis kata bahasa Inggris" className="min-h-12 flex-1 rounded-xl border-2 border-slate-200 px-4"/><button type="submit" disabled={submitted || !writtenAnswer.trim()} className="min-h-12 rounded-xl bg-[#32875D] px-5 font-extrabold text-white disabled:opacity-40">Periksa Jawaban</button></form></div>}
    {submitted && <div role="status" className={`mt-4 flex items-center gap-2 rounded-xl p-4 font-bold ${correct ? 'bg-green-50 text-green-800' : 'bg-rose-50 text-rose-800'}`}>{correct ? <CheckCircle2 size={20}/> : <XCircle size={20}/>}<span>{correct ? 'Benar!' : `Salah. Ejaan yang benar: ${word.word_en ?? ''}`}</span>{!correct && <button type="button" onClick={() => speak(word.word_en, `answer-${word.id ?? ''}`)} className="ml-auto rounded-lg bg-white p-2" aria-label="Dengarkan ejaan benar"><Volume2 size={19}/></button>}</div>}
    {submitted && <button onClick={next} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#32875D] px-5 font-extrabold text-white">{index + 1 === total ? 'Lihat Hasil' : 'Soal Berikutnya'} <ArrowRight size={18}/></button>}
  </div>
}

function PageButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  const className = active ? 'bg-[#32875D] text-white' : 'bg-white text-slate-600'
  return <button onClick={onClick} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-bold ${className}`}>{icon}{label}</button>
}
function CategoryButtons({ categories, selected, onSelect }: { categories: Category[]; selected: string; onSelect: (id: string) => void }) {
  return <div className="flex flex-wrap gap-2"><button onClick={() => onSelect('')} className={`min-h-11 rounded-xl px-4 font-bold ${!selected ? 'bg-[#32875D] text-white' : 'bg-white'}`}>Semua</button>{(categories ?? []).map((row, index) => { const item = row ?? normalizeCategory(null); const name = item.name_id || item.name_en || ''; const color = COLORS[item.color_theme ?? ''] ?? 'bg-white'; const style = selected === item.id ? 'bg-[#32875D] text-white' : color; return <button key={item.id || index} onClick={() => onSelect(item.id ?? '')} className={`min-h-11 rounded-xl px-4 font-bold ${style}`}>{item.icon_emoji ?? ''} {name}</button> })}</div>
}
function SpeakButton({ text, id, active, speak }: { text: string | null | undefined; id: string; active: string | null; speak: (text: string | null | undefined, id: string) => void }) {
  const style = active === id ? 'animate-pulse bg-[#32875D] text-white' : 'bg-[#DDF5E9] text-[#32875D]'
  return <button type="button" aria-label={`Dengarkan ${text ?? ''}`} onClick={() => speak(text, id)} className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${style}`}><Volume2 size={21}/></button>
}
export default App

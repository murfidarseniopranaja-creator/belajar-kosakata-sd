import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Crown, GraduationCap, Home, Medal, RefreshCw, Trophy, Volume2 } from 'lucide-react'
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
  const [showMeaning, setShowMeaning] = useState(false)
  const [quizWords, setQuizWords] = useState<Vocabulary[]>([])
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizScore, setQuizScore] = useState(0)
  const [answer, setAnswer] = useState<string | null>(null)
  const [quizFinished, setQuizFinished] = useState(false)
  const [scoreSaved, setScoreSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [scoreError, setScoreError] = useState('')
  const [speaking, setSpeaking] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function loadLearningData() {
      if (!supabase) {
        setDataError('Supabase belum dikonfigurasi. Kosakata contoh ditampilkan.')
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
          const detail = categoryResult.error
            ? `categories: ${categoryResult.error.message}`
            : `vocabularies: ${vocabularyResult.error?.message ?? 'Permintaan gagal.'}`
          setDataError(`Koneksi Supabase gagal: ${detail}. Kosakata contoh ditampilkan sementara.`)
          setCategories(SAMPLE_CATEGORIES)
          setVocabularies(SAMPLE_VOCABULARY)
        } else {
          const categoryRows = (categoryResult.data ?? []).map((row: Partial<Category> | null) => normalizeCategory(row))
          const vocabularyRows = (vocabularyResult.data ?? []).map((row: Partial<Vocabulary> | null) => normalizeVocabulary(row))
          setCategories(categoryRows.length ? categoryRows : SAMPLE_CATEGORIES)
          setVocabularies(vocabularyRows.length ? vocabularyRows : SAMPLE_VOCABULARY)
          setDataError('')
        }
      } catch (error) {
        if (!mounted) return
        const message = error instanceof Error ? error.message : String(error ?? '')
        setDataError(`Koneksi Supabase gagal: ${message}. Kosakata contoh ditampilkan sementara.`)
        setCategories(SAMPLE_CATEGORIES)
        setVocabularies(SAMPLE_VOCABULARY)
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
      setScoreError('Papan skor online tidak tersedia karena Supabase belum dikonfigurasi.')
      return
    }
    try {
      const { data, error } = await supabase.from('quiz_scores')
        .select('id, student_name, grade_level, category_name, score, total_questions, created_at')
        .order('score', { ascending: false })
        .limit(10)
      if (error) {
        setScoreError(`quiz_scores: ${error.message}`)
        return
      }
      setScores((data ?? []).map((row: Partial<QuizScore> | null) => normalizeScore(row)))
      setScoreError('')
    } catch (error) {
      setScoreError(`quiz_scores: ${error instanceof Error ? error.message : String(error ?? '')}`)
    }
  }

  useEffect(() => {
    void loadScores()
    if (!supabase) return
    const channel = supabase.channel('quiz-scores-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_scores' }, () => { void loadScores() })
      .subscribe()
    return () => { if (supabase) void supabase.removeChannel(channel) }
  }, [])

  const safeCategories = categories ?? []
  const safeVocabularies = vocabularies ?? []
  const category = safeCategories.find((item) => (item?.id ?? '') === (categoryId ?? '')) ?? null
  const filteredWords = useMemo(() => safeVocabularies.filter((item) => {
    const gradeMatches = Number(item?.grade_level ?? 0) === grade
    const categoryMatches = !categoryId || (item?.category_id ?? '') === categoryId
    return gradeMatches && categoryMatches
  }), [safeVocabularies, categoryId, grade])
  const currentWord = filteredWords.length ? filteredWords[wordIndex % filteredWords.length] : undefined
  const quizWord = quizWords?.[quizIndex]
  const choices = useMemo(() => {
    if (!quizWord) return []
    const distractors = safeVocabularies
      .filter((item) => item?.id !== quizWord.id && (item?.word_id ?? '') !== (quizWord.word_id ?? ''))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
    return [...distractors, quizWord].sort((a, b) => (a?.word_id ?? '').localeCompare(b?.word_id ?? ''))
  }, [quizWord, safeVocabularies])

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

  const chooseCategory = (id: string) => {
    setCategoryId(id ?? '')
    setWordIndex(0)
    setShowMeaning(false)
  }
  const startQuiz = () => {
    if (!studentName.trim()) {
      document.getElementById('student-name')?.focus()
      return
    }
    const pool = filteredWords.length ? filteredWords : safeVocabularies.filter((item) => Number(item?.grade_level ?? grade) === grade)
    const shuffled = [...pool].filter(Boolean).sort(() => Math.random() - 0.5)
    const questionCount = Math.min(grade <= 3 ? 5 : 10, shuffled.length)
    setQuizWords(shuffled.slice(0, questionCount))
    setQuizIndex(0)
    setQuizScore(0)
    setAnswer(null)
    setQuizFinished(false)
    setScoreSaved(false)
    setPage('quiz')
  }
  const chooseAnswer = (value: string) => {
    if (answer || !quizWord) return
    setAnswer(value ?? '')
    if ((value ?? '') === (quizWord.word_id ?? '')) setQuizScore((previous) => previous + 1)
  }
  const nextQuestion = () => {
    if (quizIndex + 1 < (quizWords ?? []).length) {
      setQuizIndex((index) => index + 1)
      setAnswer(null)
      return
    }
    const finalScore = quizScore + (answer === (quizWord?.word_id ?? '') ? 1 : 0)
    setQuizScore(finalScore)
    setQuizFinished(true)
    if (!supabase) return
    const categoryName = category?.name_id ?? category?.name_en ?? null
    void supabase.from('quiz_scores').insert([{
      student_name: studentName.trim() || 'Siswa',
      grade_level: grade,
      category_name: categoryName,
      score: finalScore,
      total_questions: (quizWords ?? []).length,
    }]).then(({ error }) => {
      if (error) {
        setScoreError(`Skor gagal disimpan: ${error.message}`)
        return
      }
      setScoreSaved(true)
      void loadScores()
    }).catch((error: unknown) => {
      setScoreError(`Skor gagal disimpan: ${error instanceof Error ? error.message : String(error ?? '')}`)
    })
  }

  return <div className="min-h-screen bg-[#F6FBF8] pb-24 text-[#25334A] lg:pb-0">
    <div className="mx-auto flex min-h-screen max-w-7xl">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#E8EFEA] bg-white px-6 py-7 lg:flex">
        <button onClick={() => setPage('home')} className="mb-10 flex items-center gap-3 text-left"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#DDF5E9] text-2xl">🌱</span><span><b className="block text-xl font-black">KosaKata</b><small className="font-extrabold text-slate-400">BELAJAR JADI SERU!</small></span></button>
        <p className="mb-3 px-3 text-xs font-black uppercase tracking-widest text-slate-400">Menu belajar</p>
        <div className="space-y-2">
          <NavButton active={page === 'home'} icon={<Home size={19}/>} label="Beranda" onClick={() => setPage('home')}/>
          <NavButton active={page === 'learn'} icon={<BookOpen size={19}/>} label="Kartu kata" onClick={() => setPage('learn')}/>
          <NavButton active={page === 'quiz'} icon={<CircleHelp size={19}/>} label="Kuis seru" onClick={startQuiz}/>
          <NavButton active={page === 'leaderboard'} icon={<Trophy size={19}/>} label="Papan skor" onClick={() => setPage('leaderboard')}/>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-8 pt-5 sm:px-7 lg:px-10 lg:pt-8">
        <header className="mb-7 flex items-center justify-between"><button onClick={() => setPage('home')} className="font-black lg:hidden">🌱 KosaKata</button><div className="hidden sm:block"><p className="text-sm font-bold text-slate-400">Belajar bahasa Inggris</p><p className="mt-1 text-xl font-black">Hai, Sahabat Pintar! 👋</p></div><div className="ml-auto flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm"><GraduationCap size={18}/><span className="text-sm font-extrabold">Kelas {grade} SD</span></div></header>
        {dataError && <p role="status" className="mb-5 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-900">{dataError ?? ''}</p>}
        {loading && <p className="mb-4 text-sm font-bold text-slate-500">Memuat kosakata…</p>}
        {page === 'home' && <HomePage categories={safeCategories} categoryId={categoryId} grade={grade} name={studentName} setName={setStudentName} setGrade={setGrade} chooseCategory={chooseCategory} onLearn={() => setPage('learn')} onQuiz={startQuiz} onScores={() => setPage('leaderboard')}/>}
        {page === 'learn' && <LearnPage categories={safeCategories} categoryId={categoryId} words={filteredWords ?? []} word={currentWord} wordIndex={wordIndex} meaning={showMeaning} flip={() => setShowMeaning((value) => !value)} next={() => { setWordIndex((value) => value + 1); setShowMeaning(false) }} speak={speak} speaking={speaking}/>}
        {page === 'quiz' && <QuizPage word={quizWord} choices={choices ?? []} answer={answer} score={quizScore} index={quizIndex} total={(quizWords ?? []).length} finished={quizFinished} name={studentName} scoreSaved={scoreSaved} scoreError={scoreError} category={category} choose={chooseAnswer} next={nextQuestion} goHome={() => setPage('home')} goScores={() => setPage('leaderboard')} speak={speak} speaking={speaking}/>}
        {page === 'leaderboard' && <Leaderboard scores={scores ?? []} error={scoreError ?? ''} refresh={() => { void loadScores() }}/>}
        <footer className="mt-12 flex items-center justify-center gap-2 text-xs font-bold text-slate-400">Belajar dengan gembira <Sparkles size={14} className="text-amber-400"/></footer>
      </main>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-slate-100 bg-white/95 px-2 py-2 lg:hidden"><MobileNav icon={<Home size={19}/>} label="Beranda" active={page === 'home'} click={() => setPage('home')}/><MobileNav icon={<BookOpen size={19}/>} label="Kartu kata" active={page === 'learn'} click={() => setPage('learn')}/><MobileNav icon={<CircleHelp size={19}/>} label="Kuis" active={page === 'quiz'} click={startQuiz}/><MobileNav icon={<Trophy size={19}/>} label="Papan skor" active={page === 'leaderboard'} click={() => setPage('leaderboard')}/></nav>
  </div>
}

function normalizeCategory(value: Partial<Category> | null | undefined): Category {
  return {
    id: String(value?.id ?? ''), name_en: value?.name_en ?? '', name_id: value?.name_id ?? '',
    icon_emoji: value?.icon_emoji ?? '', color_theme: value?.color_theme ?? '', sort_order: Number(value?.sort_order ?? 0),
  }
}
function normalizeVocabulary(value: Partial<Vocabulary> | null | undefined): Vocabulary {
  return {
    id: String(value?.id ?? ''), category_id: String(value?.category_id ?? ''), grade_level: Number(value?.grade_level ?? 1),
    word_en: value?.word_en ?? '', phonetic: value?.phonetic ?? '', word_id: value?.word_id ?? '',
    example_en: value?.example_en ?? '', example_id: value?.example_id ?? '', image_emoji: value?.image_emoji ?? '',
    created_at: value?.created_at ?? undefined,
  }
}
function normalizeScore(value: Partial<QuizScore> | null | undefined): QuizScore {
  return {
    id: value?.id ?? undefined, student_name: value?.student_name ?? 'Siswa', grade_level: Number(value?.grade_level ?? 1),
    category_name: value?.category_name ?? '', score: Number(value?.score ?? 0), total_questions: Number(value?.total_questions ?? 0),
    created_at: value?.created_at ?? undefined,
  }
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  const style = active ? 'bg-[#E7F6ED] text-[#318A60]' : 'text-slate-500 hover:bg-slate-50'
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-extrabold ${style}`}>{icon}{label}</button>
}
function MobileNav({ icon, label, active, click }: { icon: React.ReactNode; label: string; active: boolean; click: () => void }) {
  const style = active ? 'text-[#318A60]' : 'text-slate-400'
  return <button onClick={click} className={`flex min-w-[68px] flex-col items-center gap-1 px-1 text-[10px] font-extrabold ${style}`}>{icon}{label}</button>
}
function Speaker({ text, id, speak, speaking }: { text: string | null | undefined; id: string; speak: (text: string | null | undefined, id: string) => void; speaking: string | null }) {
  const style = speaking === id ? 'animate-pulse bg-[#32875D] text-white' : 'bg-[#EAF7EF] text-[#32875D]'
  const safeText = text ?? ''
  return <button type="button" aria-label={`Dengarkan ${safeText}`} onClick={(event) => { event.stopPropagation(); speak(safeText, id) }} className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${style}`}><Volume2 size={22}/></button>
}
function CategoryPicker({ categories, categoryId, choose }: { categories: Category[]; categoryId: string; choose: (id: string) => void }) {
  const safeCategories = categories ?? []
  return <div className="flex flex-wrap gap-2"><button onClick={() => choose('')} className={`min-h-12 rounded-2xl px-4 font-extrabold ${!categoryId ? 'bg-[#32875D] text-white' : 'bg-white shadow-sm'}`}>Semua</button>{safeCategories.map((item, index) => {
    const category = item ?? normalizeCategory(null)
    const color = COLORS[category.color_theme ?? ''] ?? 'bg-white'
    const style = category.id === categoryId ? 'bg-[#32875D] text-white' : `${color} text-[#25334A]`
    const title = category.name_id || category.name_en || ''
    return <button key={category.id || index} onClick={() => choose(category.id ?? '')} className={`min-h-12 rounded-2xl px-4 font-extrabold ${style}`}>{category.icon_emoji ?? ''} {title}</button>
  })}</div>
}
function GradePicker({ grade, setGrade }: { grade: number; setGrade: (grade: number) => void }) {
  return <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{(GRADES ?? []).map((item) => <button key={item} onClick={() => setGrade(item)} className={`min-h-14 rounded-2xl font-black ${grade === item ? 'bg-[#32875D] text-white' : 'bg-white text-slate-600 shadow-sm'}`}>Kelas {item}</button>)}</div>
}
function HomePage({ categories, categoryId, grade, name, setName, setGrade, chooseCategory, onLearn, onQuiz, onScores }: { categories: Category[]; categoryId: string; grade: number; name: string; setName: (name: string) => void; setGrade: (grade: number) => void; chooseCategory: (id: string) => void; onLearn: () => void; onQuiz: () => void; onScores: () => void }) {
  return <><section className="rounded-[30px] bg-[#DDF5E9] px-6 py-8 sm:px-10"><p className="font-black text-[#438765]">✨ WAKTUNYA BELAJAR!</p><h1 className="mt-4 text-4xl font-black sm:text-5xl">Yuk, tambah kosakata hari ini!</h1><p className="mt-3 font-semibold text-[#567665]">Belajar bahasa Inggris dengan cara seru.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={onLearn} className="min-h-12 rounded-2xl bg-[#32875D] px-5 font-extrabold text-white">Mulai belajar <ChevronRight className="inline" size={18}/></button><button onClick={onScores} className="min-h-12 rounded-2xl bg-white px-5 font-extrabold"><Trophy className="inline" size={18}/> Papan skor</button></div></section>
    <section className="mt-8 rounded-[28px] bg-white p-5 shadow-soft"><h2 className="mb-4 text-xl font-black">Nama siswa dan kelas</h2><label className="block font-bold">Nama<input id="student-name" value={name ?? ''} onChange={(event) => setName(event.target.value ?? '')} maxLength={50} placeholder="Contoh: Budi" className="mt-2 min-h-14 w-full rounded-2xl border-2 border-slate-100 px-4"/></label><p className="mb-2 mt-4 font-bold">Pilih kelas</p><GradePicker grade={grade} setGrade={setGrade}/></section>
    <section className="mt-8"><h2 className="mb-3 text-xl font-black">Pilih kategori</h2><CategoryPicker categories={categories ?? []} categoryId={categoryId ?? ''} choose={chooseCategory}/></section>
    <section className="mt-8 grid gap-4 sm:grid-cols-2"><button onClick={onLearn} className="rounded-2xl bg-white p-5 text-left font-black">📚 Kartu kata</button><button onClick={onQuiz} className="rounded-2xl bg-[#FFF1D6] p-5 text-left font-black">🧠 Mulai kuis seru</button></section>
  </>
}
function LearnPage({ categories, categoryId, words, word, wordIndex, meaning, flip, next, speak, speaking }: { categories: Category[]; categoryId: string; words: Vocabulary[]; word?: Vocabulary; wordIndex: number; meaning: boolean; flip: () => void; next: () => void; speak: (text: string | null | undefined, id: string) => void; speaking: string | null }) {
  const safeWords = words ?? []
  const category = (categories ?? []).find((item) => (item?.id ?? '') === (categoryId ?? ''))
  if (!word) return <section className="mx-auto max-w-3xl"><h1 className="mb-5 text-3xl font-black">Kartu kata</h1><CategoryPicker categories={categories ?? []} categoryId={categoryId ?? ''} choose={() => {}}/><p className="mt-5 rounded-3xl bg-white p-8">Belum ada kosakata untuk kelas ini.</p></section>
  const english = word.word_en ?? ''
  const indonesian = word.word_id ?? ''
  const wordId = word.id ?? ''
  return <section className="mx-auto max-w-3xl"><h1 className="mb-5 text-3xl font-black">Kartu kata</h1><p className="mb-4 font-bold">{category?.name_id ?? category?.name_en ?? 'Semua kategori'} · Kelas {word.grade_level ?? ''}</p><div className="mb-4 flex justify-between"><span className="rounded-full bg-white px-4 py-2 font-bold">{category?.icon_emoji ?? '📚'} {category?.name_id ?? category?.name_en ?? 'Semua kategori'}</span><span>{safeWords.length ? wordIndex % safeWords.length + 1 : 0} / {safeWords.length ?? 0}</span></div><div className="flex min-h-[350px] flex-col items-center justify-center rounded-[32px] bg-white p-8 text-center shadow-soft"><span className="text-7xl">{word.image_emoji ?? ''}</span><h2 className="mt-5 text-4xl font-black">{meaning ? indonesian : english}</h2><p className="mt-2 text-slate-500">{meaning ? english : word.phonetic ?? ''}</p><div className="mt-5 flex gap-3"><Speaker text={english} id={`word-${wordId}`} speak={speak} speaking={speaking}/><button onClick={flip} className="rounded-2xl bg-[#EAF7EF] px-5 font-bold">{meaning ? 'Lihat kata' : 'Lihat arti'}</button></div><div className="mt-7 w-full rounded-2xl bg-[#F7FAF8] p-4 text-left"><div className="flex items-center justify-between gap-3"><p className="font-bold">“{word.example_en ?? ''}”</p><Speaker text={word.example_en} id={`example-${wordId}`} speak={speak} speaking={speaking}/></div>{Boolean(word.example_id) && <p className="mt-2 text-sm text-slate-500">{word.example_id ?? ''}</p>}</div></div><div className="mt-5 flex justify-end"><button onClick={next} className="rounded-2xl bg-[#32875D] px-5 py-3 font-bold text-white">Berikutnya <ChevronRight className="inline"/></button></div></section>
}
function QuizPage({ word, choices, answer, score, index, total, finished, name, scoreSaved, scoreError, category, choose, next, goHome, goScores, speak, speaking }: { word?: Vocabulary; choices: Vocabulary[]; answer: string | null; score: number; index: number; total: number; finished: boolean; name: string; scoreSaved: boolean; scoreError: string; category: Category | null; choose: (answer: string) => void; next: () => void; goHome: () => void; goScores: () => void; speak: (text: string | null | undefined, id: string) => void; speaking: string | null }) {
  const safeChoices = choices ?? []
  if (finished) return <section className="mx-auto max-w-2xl rounded-[32px] bg-white p-10 text-center"><Trophy className="mx-auto text-amber-500" size={56}/><h1 className="mt-4 text-3xl font-black">Hebat, {name ?? 'Siswa'}!</h1><p className="mt-2 text-xl font-bold">Skor {score ?? 0} dari {total ?? 0}</p><p className="mt-3">{scoreSaved ? 'Skor tersimpan!' : 'Skor belum tersimpan.'}</p>{scoreError && <p role="status" className="mt-2 text-sm text-rose-700">{scoreError ?? ''}</p>}<button onClick={goHome} className="mt-5 rounded-2xl bg-[#32875D] px-5 py-3 font-bold text-white">Kembali</button><button onClick={goScores} className="ml-2 mt-5 rounded-2xl bg-[#FFF1D6] px-5 py-3 font-bold">Papan skor</button></section>
  if (!word || total === 0) return <section className="rounded-3xl bg-white p-8">Belum ada kata untuk kuis ini.</section>
  const english = word.word_en ?? ''
  const correctAnswer = word.word_id ?? ''
  return <section className="mx-auto max-w-2xl"><div className="mb-5 flex justify-between"><h1 className="text-2xl font-black">Kuis seru, {name ?? 'Siswa'}!</h1><b>⭐ {score ?? 0}</b></div><div className="rounded-[30px] bg-white p-6 shadow-soft"><div className="mb-5 flex justify-between"><b>Soal {index + 1} / {total}</b><span>{category?.name_id ?? category?.name_en ?? 'Semua kategori'}</span></div><div className="mb-5 flex items-center justify-center gap-3 rounded-3xl bg-[#F7FAF8] p-6"><span className="text-5xl">{word.image_emoji ?? ''}</span><div className="text-center"><p className="text-sm text-slate-400">Apa arti kata ini?</p><b className="text-3xl">{english}</b></div><Speaker text={english} id={`quiz-${word.id ?? ''}`} speak={speak} speaking={speaking}/></div><div className="grid gap-3 sm:grid-cols-2">{safeChoices.map((choice, choiceIndex) => {
    const item = choice ?? normalizeVocabulary(null)
    const choiceText = item.word_id ?? ''
    const isCorrect = choiceText === correctAnswer
    const style = answer ? (isCorrect ? 'border-green-400 bg-green-50' : answer === choiceText ? 'border-rose-300 bg-rose-50' : 'border-slate-100') : 'border-slate-100 hover:border-green-300'
    return <button key={item.id || choiceIndex} disabled={Boolean(answer)} onClick={() => choose(choiceText)} className={`min-h-14 rounded-2xl border-2 p-3 text-left font-bold ${style}`}>{choiceText}{answer && isCorrect && <Check className="float-right"/>}</button>
  })}</div>{answer && <p className="mt-4 text-center font-bold">{answer === correctAnswer ? '🎉 Betul!' : `Jawaban: ${correctAnswer}`}</p>}<div className="mt-5 flex justify-between"><button onClick={goHome} className="font-bold text-slate-500"><ChevronLeft className="inline"/> Keluar</button><button disabled={!answer} onClick={next} className="rounded-2xl bg-[#32875D] px-5 py-3 font-bold text-white disabled:opacity-40">{index + 1 === total ? 'Selesai' : 'Berikutnya'} <ChevronRight className="inline"/></button></div></div></section>
}
function Leaderboard({ scores, error, refresh }: { scores: QuizScore[]; error: string; refresh: () => void }) {
  const safeScores = scores ?? []
  const medals = [<Crown className="text-amber-500" key="first"/>, <Medal className="text-slate-400" key="second"/>, <Medal className="text-orange-500" key="third"/>]
  return <section className="mx-auto max-w-3xl"><div className="mb-5 flex items-center justify-between"><h1 className="text-3xl font-black">🏆 Papan Skor</h1><button onClick={refresh} className="rounded-xl bg-white p-3 font-bold"><RefreshCw className="inline" size={17}/> Perbarui</button></div>{error && <p role="status" className="mb-4 rounded-xl bg-amber-100 p-3 font-bold">{error ?? ''}</p>}<div className="overflow-hidden rounded-3xl bg-white"><div className="grid grid-cols-[55px_1fr_auto] bg-[#DDF5E9] p-4 font-black"><span>#</span><span>Nama</span><span>Skor</span></div>{safeScores.length ? safeScores.map((item, index) => {
    const row = item ?? normalizeScore(null)
    const rank = index < 3 ? medals[index] : index + 1
    return <div key={row.id ?? `${row.student_name ?? 'Siswa'}-${index}`} className="grid grid-cols-[55px_1fr_auto] items-center border-t p-4"><span>{rank}</span><b>{row.student_name ?? 'Siswa'}<small className="block text-slate-400">Kelas {row.grade_level ?? ''} · {row.category_name ?? 'Semua kategori'}</small></b><b>{row.score ?? 0}/{row.total_questions ?? 0}</b></div>
  }) : <p className="p-8 text-center font-bold">Belum ada skor. Jadilah yang pertama!</p>}</div><p className="mt-3 text-xs text-slate-400">Papan skor diperbarui otomatis.</p></section>
}

export default App

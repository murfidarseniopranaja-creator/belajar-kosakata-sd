import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Crown, GraduationCap, Home, Medal, RefreshCw, RotateCcw, Sparkles, Trophy, Volume2 } from 'lucide-react'
import { SAMPLE_CATEGORIES, SAMPLE_VOCABULARY, supabase, type Category, type QuizScore, type Vocabulary } from './lib/supabase'

type Page = 'home' | 'learn' | 'quiz' | 'leaderboard'
const grades = [1, 2, 3, 4, 5, 6]
const colors: Record<string, string> = { mint: 'bg-[#DDF5E9]', sunshine: 'bg-[#FFE7A3]', lavender: 'bg-[#E9E2FF]', coral: 'bg-[#FFE0D9]' }

function App() {
  const [page, setPage] = useState<Page>('home')
  const [categories, setCategories] = useState<Category[]>(SAMPLE_CATEGORIES)
  const [vocabulary, setVocabulary] = useState<Vocabulary[]>(SAMPLE_VOCABULARY)
  const [categoryId, setCategoryId] = useState('')
  const [grade, setGrade] = useState(1)
  const [studentName, setStudentName] = useState('')
  const [currentWord, setCurrentWord] = useState(0)
  const [showMeaning, setShowMeaning] = useState(false)
  const [savedWords, setSavedWords] = useState<string[]>([])
  const [quizWords, setQuizWords] = useState<Vocabulary[]>([])
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizScore, setQuizScore] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [quizFinished, setQuizFinished] = useState(false)
  const [scoreSaved, setScoreSaved] = useState(false)
  const [leaderboard, setLeaderboard] = useState<QuizScore[]>([])
  const [dataMessage, setDataMessage] = useState('')
  const [leaderboardMessage, setLeaderboardMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeSpeech, setActiveSpeech] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const loadLearningData = async () => {
      if (!supabase) {
        setDataMessage('Mode belajar contoh: Supabase belum dikonfigurasi. Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY atau VITE_SUPABASE_PUBLISHABLE_KEY tersedia di Vercel.')
        setLoading(false)
        return
      }
      try {
        const [categoryResult, vocabularyResult] = await Promise.all([
          supabase.from('categories').select('*').order('sort_order', { ascending: true }),
          supabase.from('vocabulary').select('*').order('english', { ascending: true }),
        ])
        if (!mounted) return
        const categoryError = categoryResult.error
        const vocabularyError = vocabularyResult.error
        if (categoryError || vocabularyError) {
          const detail = categoryError
            ? `categories: ${categoryError.message}`
            : `vocabulary: ${vocabularyError?.message ?? 'Permintaan gagal tanpa pesan error.'}`
          setCategories(SAMPLE_CATEGORIES)
          setVocabulary(SAMPLE_VOCABULARY)
          setDataMessage(`Koneksi Supabase gagal: ${detail}. Kosakata contoh ditampilkan sementara.`)
        } else {
          setCategories((categoryResult.data ?? []) as Category[])
          setVocabulary((vocabularyResult.data ?? []) as Vocabulary[])
          setDataMessage('')
        }
      } catch (error) {
        if (!mounted) return
        const detail = error instanceof Error ? error.message : String(error)
        setCategories(SAMPLE_CATEGORIES)
        setVocabulary(SAMPLE_VOCABULARY)
        setDataMessage(`Koneksi Supabase gagal: ${detail}. Kosakata contoh ditampilkan sementara.`)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void loadLearningData()
    return () => { mounted = false }
  }, [])

  const loadLeaderboard = async () => {
    if (!supabase) {
      setLeaderboard([])
      setLeaderboardMessage('Papan skor online tidak tersedia karena konfigurasi Supabase belum lengkap.')
      return
    }
    try {
      const { data, error } = await supabase.from('quiz_scores')
        .select('id, player_name, score, total_questions, category_id, created_at')
        .order('score', { ascending: false }).order('created_at', { ascending: true }).limit(10)
      if (error) {
        setLeaderboardMessage(`Supabase quiz_scores: ${error.message}`)
        return
      }
      setLeaderboard((data ?? []) as QuizScore[])
      setLeaderboardMessage('')
    } catch (error) {
      setLeaderboardMessage(`Supabase quiz_scores: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  useEffect(() => {
    void loadLeaderboard()
    if (!supabase) return
    const channel = supabase.channel('quiz-scores-leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_scores' }, () => { void loadLeaderboard() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [])

  const filteredVocabulary = useMemo(() => vocabulary.filter((item) => !categoryId || item.category_id === categoryId), [vocabulary, categoryId])
  const word = filteredVocabulary.length ? filteredVocabulary[currentWord % filteredVocabulary.length] : undefined
  const quizWord = quizWords[quizIndex]
  const options = useMemo(() => {
    if (!quizWord) return []
    const otherWords = vocabulary.filter((item) => item.id !== quizWord.id && item.indonesian !== quizWord.indonesian)
      .sort(() => Math.random() - 0.5).slice(0, 3)
    return [...otherWords, quizWord].sort((a, b) => a.indonesian.localeCompare(b.indonesian))
  }, [quizWord, vocabulary])
  const selectedCategory = categories.find((item) => item.id === categoryId) ?? null

  const speak = (text: string, id: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.85
    utterance.onstart = () => setActiveSpeech(id)
    utterance.onend = () => setActiveSpeech(null)
    utterance.onerror = () => setActiveSpeech(null)
    setActiveSpeech(id)
    window.speechSynthesis.speak(utterance)
  }

  const startQuiz = () => {
    if (!studentName.trim()) { document.getElementById('student-name')?.focus(); return }
    const pool = filteredVocabulary.length ? filteredVocabulary : vocabulary
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    setQuizWords(shuffled.slice(0, Math.min(grade <= 3 ? 5 : 10, shuffled.length)))
    setQuizIndex(0); setQuizScore(0); setSelectedAnswer(null); setQuizFinished(false); setScoreSaved(false); setPage('quiz')
  }

  const answerQuiz = (answer: string) => {
    if (selectedAnswer || !quizWord) return
    setSelectedAnswer(answer)
    if (answer === quizWord.indonesian) setQuizScore((score) => score + 1)
  }

  const nextQuestion = () => {
    if (quizIndex + 1 < quizWords.length) { setQuizIndex((index) => index + 1); setSelectedAnswer(null); return }
    const finalScore = quizScore + (selectedAnswer === quizWord?.indonesian ? 1 : 0)
    setQuizScore(finalScore); setQuizFinished(true)
    if (!supabase) return
    void supabase.from('quiz_scores').insert({ player_name: studentName.trim(), score: finalScore, total_questions: quizWords.length, category_id: categoryId || null })
      .then(({ error }) => {
        if (error) { setLeaderboardMessage(`Skor gagal disimpan ke quiz_scores: ${error.message}`); return }
        setScoreSaved(true); void loadLeaderboard()
      }).catch((error: unknown) => setLeaderboardMessage(`Skor gagal disimpan: ${error instanceof Error ? error.message : String(error)}`))
  }

  const selectCategory = (id: string) => { setCategoryId(id); setCurrentWord(0); setShowMeaning(false) }
  const goTo = (nextPage: Page) => setPage(nextPage)

  return <div className="min-h-screen bg-[#F6FBF8] pb-24 text-[#25334A] lg:pb-0">
    <div className="mx-auto flex min-h-screen max-w-7xl">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#E8EFEA] bg-white px-6 py-7 lg:flex">
        <button onClick={() => goTo('home')} className="mb-10 flex items-center gap-3 text-left"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#DDF5E9] text-2xl">🌱</span><span><b className="block text-xl font-black">KosaKata</b><small className="font-extrabold text-slate-400">BELAJAR JADI SERU!</small></span></button>
        <p className="mb-3 px-3 text-xs font-black uppercase tracking-widest text-slate-400">Menu belajar</p>
        <div className="space-y-2">
          <NavButton active={page === 'home'} icon={<Home size={19}/>} label="Beranda" onClick={() => goTo('home')}/>
          <NavButton active={page === 'learn'} icon={<BookOpen size={19}/>} label="Kartu kata" onClick={() => goTo('learn')}/>
          <NavButton active={page === 'quiz'} icon={<CircleHelp size={19}/>} label="Kuis seru" onClick={startQuiz}/>
          <NavButton active={page === 'leaderboard'} icon={<Trophy size={19}/>} label="Papan skor" onClick={() => goTo('leaderboard')}/>
        </div>
        <div className="mt-auto rounded-3xl bg-[#F0F8F3] p-5"><div className="mb-3 text-3xl">🚀</div><b>Terus semangat!</b><p className="mt-1 text-sm leading-6 text-slate-500">Sedikit belajar setiap hari bikin kamu makin hebat.</p></div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-8 pt-5 sm:px-7 lg:px-10 lg:pt-8">
        <header className="mb-7 flex items-center justify-between"><button onClick={() => goTo('home')} className="flex items-center gap-2 font-black lg:hidden"><span className="text-2xl">🌱</span>KosaKata</button><div className="hidden sm:block"><p className="text-sm font-bold text-slate-400">Belajar bahasa Inggris</p><p className="mt-1 text-xl font-black">Hai, Sahabat Pintar! 👋</p></div><div className="ml-auto flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm"><GraduationCap size={18} className="text-[#32875D]"/><span className="text-sm font-extrabold">Kelas {grade} SD</span></div></header>
        {dataMessage && <p role="status" className="mb-5 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-900">{dataMessage}</p>}
        {loading && <p className="mb-4 text-sm font-bold text-slate-500">Memuat kosakata…</p>}
        {page === 'home' && <HomePage categories={categories} categoryId={categoryId} grade={grade} name={studentName} onName={setStudentName} onGrade={setGrade} onCategory={selectCategory} onLearn={() => goTo('learn')} onQuiz={startQuiz} onLeaderboard={() => goTo('leaderboard')}/>}
        {page === 'learn' && <LearnPage categories={categories} categoryId={categoryId} words={filteredVocabulary} word={word} currentWord={currentWord} showMeaning={showMeaning} saved={word ? savedWords.includes(word.id) : false} onCategory={selectCategory} onFlip={() => setShowMeaning((value) => !value)} onNext={() => { setCurrentWord((value) => value + 1); setShowMeaning(false) }} onSave={() => { if (!word) return; setSavedWords((saved) => saved.includes(word.id) ? saved.filter((id) => id !== word.id) : [...saved, word.id]) }} speak={speak} activeSpeech={activeSpeech}/>}
        {page === 'quiz' && <QuizPage word={quizWord} options={options} selected={selectedAnswer} score={quizScore} index={quizIndex} total={quizWords.length} finished={quizFinished} name={studentName} scoreSaved={scoreSaved} category={selectedCategory} onAnswer={answerQuiz} onNext={nextQuestion} onBack={() => goTo('home')} onLeaderboard={() => goTo('leaderboard')} speak={speak} activeSpeech={activeSpeech}/>}
        {page === 'leaderboard' && <LeaderboardPage scores={leaderboard} categories={categories} message={leaderboardMessage} onRefresh={() => void loadLeaderboard()}/>}
        <footer className="mt-12 flex items-center justify-center gap-2 text-xs font-bold text-slate-400"><span>Belajar dengan gembira</span><Sparkles size={14} className="text-amber-400"/></footer>
      </main>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-slate-100 bg-white/95 px-2 py-2 backdrop-blur lg:hidden"><MobileNav icon={<Home size={19}/>} label="Beranda" active={page === 'home'} onClick={() => goTo('home')}/><MobileNav icon={<BookOpen size={19}/>} label="Kartu kata" active={page === 'learn'} onClick={() => goTo('learn')}/><MobileNav icon={<CircleHelp size={19}/>} label="Kuis" active={page === 'quiz'} onClick={startQuiz}/><MobileNav icon={<Trophy size={19}/>} label="Papan skor" active={page === 'leaderboard'} onClick={() => goTo('leaderboard')}/></nav>
  </div>
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-extrabold transition ${active ? 'bg-[#E7F6ED] text-[#318A60]' : 'text-slate-500 hover:bg-slate-50'}`}>{icon}{label}</button>
}
function MobileNav({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex min-w-[68px] flex-col items-center gap-1 rounded-xl px-1 py-1 text-[10px] font-extrabold ${active ? 'text-[#318A60]' : 'text-slate-400'}`}>{icon}{label}</button>
}
function Speaker({ text, id, speak, activeSpeech }: { text: string; id: string; speak: (text: string, id: string) => void; activeSpeech: string | null }) {
  const active = activeSpeech === id
  return <button type="button" aria-label={`Dengarkan ${text}`} onClick={(event) => { event.stopPropagation(); speak(text, id) }} className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition ${active ? 'scale-110 animate-pulse bg-[#32875D] text-white' : 'bg-[#EAF7EF] text-[#32875D]'}`}><Volume2 size={22}/></button>
}
function CategoryPicker({ categories, categoryId, onCategory }: { categories: Category[]; categoryId: string; onCategory: (id: string) => void }) {
  return <div className="flex flex-wrap gap-2"><button onClick={() => onCategory('')} className={`min-h-12 rounded-2xl px-4 font-extrabold ${!categoryId ? 'bg-[#32875D] text-white' : 'bg-white shadow-sm'}`}>Semua</button>{categories.map((item) => <button key={item.id} onClick={() => onCategory(item.id)} className={`min-h-12 rounded-2xl px-4 font-extrabold ${categoryId === item.id ? 'bg-[#32875D] text-white' : `${colors[item.color] ?? 'bg-white'} text-[#25334A]'}`}>{item.emoji} {item.name}</button>)}</div>
}
function GradePicker({ grade, onGrade }: { grade: number; onGrade: (grade: number) => void }) {
  return <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{grades.map((item) => <button key={item} onClick={() => onGrade(item)} className={`min-h-14 rounded-2xl text-lg font-black ${grade === item ? 'bg-[#32875D] text-white' : 'bg-white text-slate-600 shadow-sm'}`}>Kelas {item}</button>)}</div>
}
function HomePage({ categories, categoryId, grade, name, onName, onGrade, onCategory, onLearn, onQuiz, onLeaderboard }: { categories: Category[]; categoryId: string; grade: number; name: string; onName: (value: string) => void; onGrade: (value: number) => void; onCategory: (value: string) => void; onLearn: () => void; onQuiz: () => void; onLeaderboard: () => void }) {
  return <>
    <section className="relative overflow-hidden rounded-[30px] bg-[#DDF5E9] px-6 py-8 sm:px-10"><span className="rounded-full bg-white/80 px-3 py-2 text-xs font-black text-[#438765]"><Sparkles size={14} className="inline"/> WAKTUNYA BELAJAR!</span><h1 className="mt-4 text-4xl font-black sm:text-5xl">Yuk, tambah <span className="text-[#33875D]">kosakata</span> hari ini!</h1><p className="mt-3 max-w-lg font-semibold leading-7 text-[#567665]">Belajar kata-kata bahasa Inggris baru dengan cara seru dan gampang diingat.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={onLearn} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#32875D] px-5 font-extrabold text-white">Mulai belajar <ChevronRight size={18}/></button><button onClick={onLeaderboard} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 font-extrabold text-[#32875D]"><Trophy size={18}/> Papan skor</button></div></section>
    <section className="mt-8 rounded-[28px] bg-white p-5 shadow-soft sm:p-7"><h2 className="mb-4 text-xl font-black">Isi nama dan pilih kelas</h2><div className="grid gap-5 md:grid-cols-[.8fr_1.2fr]"><label className="text-sm font-extrabold">Nama siswa<input id="student-name" value={name} onChange={(event) => onName(event.target.value)} maxLength={50} placeholder="Contoh: Budi" className="mt-2 min-h-14 w-full rounded-2xl border-2 border-[#E5EEE8] px-4 outline-none focus:border-[#61C897]"/></label><div><p className="mb-2 text-sm font-extrabold">Tingkat kelas</p><GradePicker grade={grade} onGrade={onGrade}/></div></div></section>
    <section className="mt-8"><h2 className="mb-3 text-xl font-black">Pilih kategori belajar</h2><CategoryPicker categories={categories} categoryId={categoryId} onCategory={onCategory}/></section>
    <section className="mt-8 grid gap-4 md:grid-cols-2"><button onClick={onLearn} className="rounded-[26px] bg-white p-6 text-left shadow-soft"><span className="text-4xl">📚</span><h3 className="mt-3 text-xl font-black">Kartu kata</h3><p className="mt-1 font-semibold text-slate-500">Baca dan dengarkan kata baru.</p></button><button onClick={onQuiz} className="rounded-[26px] bg-[#FFF1D6] p-6 text-left"><span className="text-4xl">🧠</span><h3 className="mt-3 text-xl font-black">Kuis seru</h3><p className="mt-1 font-semibold text-slate-500">Jawab dan kumpulkan bintang!</p></button></section>
  </>
}
function LearnPage({ categories, categoryId, words, word, currentWord, showMeaning, saved, onCategory, onFlip, onNext, onSave, speak, activeSpeech }: { categories: Category[]; categoryId: string; words: Vocabulary[]; word?: Vocabulary; currentWord: number; showMeaning: boolean; saved: boolean; onCategory: (id: string) => void; onFlip: () => void; onNext: () => void; onSave: () => void; speak: (text: string, id: string) => void; activeSpeech: string | null }) {
  const category = categories.find((item) => item.id === categoryId)
  return <section className="mx-auto max-w-3xl"><button onClick={() => setTimeout(() => onCategory(categoryId), 0)} className="mb-4 inline-flex items-center gap-2 font-extrabold text-[#32875D]"><ChevronLeft size={18}/>Kembali</button><h1 className="mb-5 text-3xl font-black">Kartu kata</h1><div className="mb-5"><p className="mb-2 font-extrabold">Pilih kategori</p><CategoryPicker categories={categories} categoryId={categoryId} onCategory={onCategory}/></div>{!word ? <div className="rounded-3xl bg-white p-8 text-center font-bold">Belum ada kata di kategori ini.</div> : <><div className="mb-4 flex justify-between"><span className="rounded-full bg-white px-4 py-2 font-extrabold">{category?.emoji ?? '📚'} {category?.name ?? 'Semua kategori'}</span><span className="font-bold text-slate-400">{currentWord % words.length + 1} dari {words.length}</span></div><div className="flex min-h-[350px] flex-col items-center justify-center rounded-[32px] bg-white p-7 text-center shadow-soft"><span className="text-7xl">{word.emoji}</span><h2 className="mt-5 text-4xl font-black">{showMeaning ? word.indonesian : word.english}</h2><p className="mt-2 font-bold text-slate-400">{showMeaning ? word.english : word.pronunciation}</p><div className="mt-5 flex gap-3"><Speaker text={word.english} id={`word-${word.id}`} speak={speak} activeSpeech={activeSpeech}/><button onClick={onFlip} className="min-h-12 rounded-2xl bg-[#F0F8F3] px-5 font-extrabold text-[#32875D]">{showMeaning ? 'Lihat kata' : 'Lihat artinya'}</button></div><div className="mt-7 flex max-w-xl items-center gap-3 rounded-2xl bg-[#F7FAF8] p-4 text-left"><div><p className="text-xs font-black uppercase text-slate-400">Contoh kalimat</p><p className="mt-1 font-bold">“{word.example}”</p></div><Speaker text={word.example} id={`example-${word.id}`} speak={speak} activeSpeech={activeSpeech}/></div></div><div className="mt-5 flex justify-center gap-3"><button onClick={onSave} className={`min-h-12 rounded-2xl px-5 font-extrabold ${saved ? 'bg-rose-100 text-rose-600' : 'bg-white shadow-sm'}`}>{saved ? '♥ Tersimpan' : '♡ Simpan kata'}</button><button onClick={onNext} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#32875D] px-5 font-extrabold text-white">Kata berikutnya <ChevronRight size={18}/></button></div></>}</section>
}
function QuizPage({ word, options, selected, score, index, total, finished, name, scoreSaved, category, onAnswer, onNext, onBack, onLeaderboard, speak, activeSpeech }: { word?: Vocabulary; options: Vocabulary[]; selected: string | null; score: number; index: number; total: number; finished: boolean; name: string; scoreSaved: boolean; category: Category | null; onAnswer: (answer: string) => void; onNext: () => void; onBack: () => void; onLeaderboard: () => void; speak: (text: string, id: string) => void; activeSpeech: string | null }) {
  if (finished) return <section className="mx-auto max-w-2xl rounded-[32px] bg-white p-10 text-center shadow-soft"><div className="text-6xl">🏆</div><h1 className="mt-4 text-3xl font-black">Hebat, {name}!</h1><p className="mt-2 text-xl font-extrabold">Skormu {score} dari {total}</p><p className="mt-3 font-semibold text-slate-500">{scoreSaved ? 'Skor tersimpan di papan skor.' : 'Skor disimpan jika Supabase terhubung.'}</p><div className="mt-6 flex justify-center gap-3"><button onClick={onBack} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#32875D] px-5 font-extrabold text-white"><RotateCcw size={17}/> Belajar lagi</button><button onClick={onLeaderboard} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#FFF1D6] px-5 font-extrabold"><Trophy size={17}/> Papan skor</button></div></section>
  if (!word || total === 0) return <section className="rounded-3xl bg-white p-8 text-center"><p className="font-bold">Belum ada kosakata untuk kuis ini.</p><button onClick={onBack} className="mt-4 font-extrabold text-[#32875D]">Kembali</button></section>
  return <section className="mx-auto max-w-2xl"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-slate-400">Kuis seru</p><h1 className="text-2xl font-black">Ayo jawab, {name}!</h1></div><span className="rounded-full bg-white px-4 py-2 font-extrabold">⭐ {score}</span></div><div className="rounded-[30px] bg-white p-6 shadow-soft sm:p-9"><div className="mb-6 flex justify-between"><span className="rounded-full bg-[#F2F8F4] px-4 py-2 font-extrabold">Soal {index + 1} / {total}</span><span className="font-bold text-slate-400">{category?.name ?? 'Semua kategori'}</span></div><div className="mb-6 flex items-center justify-center gap-3 rounded-3xl bg-[#F7FAF8] p-6"><span className="text-5xl">{word.emoji}</span><div className="text-center"><p className="text-sm text-slate-400">Apa arti kata ini?</p><p className="text-3xl font-black">{word.english}</p></div><Speaker text={word.english} id={`quiz-${word.id}`} speak={speak} activeSpeech={activeSpeech}/></div><div className="grid gap-3 sm:grid-cols-2">{options.map((option) => { const correct = option.indonesian === word.indonesian; const chosen = selected === option.indonesian; let style = 'border-slate-100 bg-white hover:border-[#75C99A]'; if (selected && correct) style = 'border-[#4BB77D] bg-[#E4F7EB] text-[#287A4F]'; else if (selected && chosen) style = 'border-rose-300 bg-rose-50 text-rose-700'; else if (selected) style = 'border-slate-100 text-slate-400'; return <button key={option.id} onClick={() => onAnswer(option.indonesian)} disabled={Boolean(selected)} className={`flex min-h-16 items-center justify-between rounded-2xl border-2 px-4 text-left font-extrabold ${style}`}><span>{option.indonesian}</span>{selected && correct && <Check size={19}/>}</button> })}</div>{selected && <p className="mt-5 rounded-2xl bg-[#F7FAF8] p-4 text-center font-bold">{selected === word.indonesian ? '🎉 Betul sekali!' : `Belum tepat. Jawabannya ${word.indonesian}.`}</p>}<div className="mt-6 flex justify-between"><button onClick={onBack} className="inline-flex min-h-12 items-center gap-2 px-4 font-extrabold text-slate-500"><ChevronLeft size={18}/> Keluar</button><button onClick={onNext} disabled={!selected} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#32875D] px-5 font-extrabold text-white disabled:opacity-40">{index + 1 === total ? 'Lihat skor' : 'Soal berikutnya'} <ChevronRight size={18}/></button></div></div></section>
}
function LeaderboardPage({ scores, categories, message, onRefresh }: { scores: QuizScore[]; categories: Category[]; message: string; onRefresh: () => void }) {
  const medals = [<Crown size={22} className="text-amber-500" key="gold"/>, <Medal size={22} className="text-slate-400" key="silver"/>, <Medal size={22} className="text-orange-500" key="bronze"/>]
  return <section className="mx-auto max-w-3xl"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-slate-400">Juara kosakata</p><h1 className="mt-1 text-3xl font-black">🏆 Papan Skor</h1><p className="mt-2 font-semibold text-slate-500">Sepuluh skor terbaik teman-teman!</p></div><button onClick={onRefresh} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 font-extrabold shadow-sm"><RefreshCw size={17}/> Perbarui</button></div>{message && <p role="status" className="mb-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-900">{message}</p>}<div className="overflow-hidden rounded-[28px] bg-white shadow-soft"><div className="grid grid-cols-[52px_1fr_auto] gap-3 bg-[#DDF5E9] px-4 py-4 text-xs font-black uppercase text-[#438765] sm:grid-cols-[64px_1fr_1fr_auto]"><span>Peringkat</span><span>Nama</span><span className="hidden sm:block">Kategori</span><span>Skor</span></div>{scores.length ? scores.map((item, index) => <div key={item.id ?? `${item.player_name}-${index}`} className={`grid grid-cols-[52px_1fr_auto] items-center gap-3 border-t px-4 py-4 sm:grid-cols-[64px_1fr_1fr_auto] ${index < 3 ? 'bg-amber-50/40' : ''}`}><span className="grid h-10 w-10 place-items-center rounded-full bg-[#F7FAF8] font-black">{index < 3 ? medals[index] : index + 1}</span><span className="font-extrabold">{item.player_name}</span><span className="hidden text-sm font-bold text-slate-500 sm:block">{categories.find((category) => category.id === item.category_id)?.name ?? 'Semua kategori'}</span><span className="rounded-xl bg-[#FFF1D6] px-3 py-2 text-sm font-black">{item.score}/{item.total_questions}</span></div>) : <div className="p-10 text-center"><span className="text-5xl">🌟</span><p className="mt-3 font-extrabold">Belum ada skor. Jadilah yang pertama!</p></div>}</div><p className="mt-3 text-xs font-semibold text-slate-400">Papan skor diperbarui otomatis saat ada hasil kuis baru.</p></section>
}

export default App

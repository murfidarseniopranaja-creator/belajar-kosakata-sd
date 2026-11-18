import { useMemo, useState } from 'react'
import { BookOpen, Check, ChevronRight, CircleHelp, Flame, GraduationCap, Headphones, Heart, Home, RotateCcw, Sparkles, Star, Volume2 } from 'lucide-react'
import { isSupabaseConfigured, SAMPLE_CATEGORIES, SAMPLE_VOCABULARY, type Vocabulary } from './lib/supabase'

type Page = 'home' | 'learn' | 'quiz'

const categoryStyles: Record<string, string> = {
  mint: 'bg-mint', sunshine: 'bg-sunshine', lavender: 'bg-lavender', coral: 'bg-[#FFE0D9]',
}

function App() {
  const [page, setPage] = useState<Page>('home')
  const [categoryId, setCategoryId] = useState('animals')
  const [currentWord, setCurrentWord] = useState(0)
  const [showMeaning, setShowMeaning] = useState(false)
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizScore, setQuizScore] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [savedWords, setSavedWords] = useState<string[]>([])

  const category = SAMPLE_CATEGORIES.find((item) => item.id === categoryId) ?? SAMPLE_CATEGORIES[0]
  const words = useMemo(() => SAMPLE_VOCABULARY.filter((word) => word.category_id === categoryId), [categoryId])
  const word = words[currentWord % Math.max(words.length, 1)]
  const quizWord = SAMPLE_VOCABULARY[quizIndex % SAMPLE_VOCABULARY.length]
  const options = useMemo(() => {
    const distractors = SAMPLE_VOCABULARY.filter((item) => item.id !== quizWord.id).slice(0, 3)
    return [...distractors, quizWord].sort((a, b) => a.indonesian.localeCompare(b.indonesian))
  }, [quizWord])

  const chooseCategory = (id: string) => {
    setCategoryId(id)
    setCurrentWord(0)
    setShowMeaning(false)
  }

  const startQuiz = () => {
    setQuizIndex(0)
    setQuizScore(0)
    setSelectedAnswer(null)
    setPage('quiz')
  }

  const answerQuiz = (answer: string) => {
    if (selectedAnswer) return
    setSelectedAnswer(answer)
    if (answer === quizWord.indonesian) setQuizScore((score) => score + 1)
  }

  const nextQuestion = () => {
    setQuizIndex((index) => (index + 1) % SAMPLE_VOCABULARY.length)
    setSelectedAnswer(null)
  }

  const toggleSaved = (id: string) => {
    setSavedWords((saved) => saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id])
  }

  return (
    <div className="min-h-screen bg-[#F6FBF8] text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-[245px] shrink-0 flex-col border-r border-[#E8EFEA] bg-white px-6 py-7 lg:flex">
          <button onClick={() => setPage('home')} className="mb-12 flex items-center gap-3 text-left">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#DDF5E9] text-2xl">🌱</span>
            <span><span className="block text-lg font-black tracking-tight">KosaKata</span><span className="text-xs font-bold text-slate-400">BELAJAR JADI SERU!</span></span>
          </button>
          <p className="mb-3 px-3 text-[11px] font-extrabold uppercase tracking-[.15em] text-slate-400">Menu belajar</p>
          <nav className="space-y-2">
            <NavButton active={page === 'home'} icon={<Home size={19} />} label="Beranda" onClick={() => setPage('home')} />
            <NavButton active={page === 'learn'} icon={<BookOpen size={19} />} label="Kartu kata" onClick={() => setPage('learn')} />
            <NavButton active={page === 'quiz'} icon={<CircleHelp size={19} />} label="Kuis seru" onClick={startQuiz} />
          </nav>
          <div className="mt-auto rounded-[24px] bg-[#F0F8F3] p-5">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-white text-xl shadow-sm">🚀</div>
            <p className="font-extrabold">Terus semangat!</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Sedikit belajar setiap hari bikin kamu makin hebat.</p>
            <div className="mt-4 h-2 rounded-full bg-white"><div className="h-2 w-2/3 rounded-full bg-[#61C897]" /></div>
            <p className="mt-2 text-[11px] font-bold text-slate-500">3 dari 5 hari minggu ini</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 pb-12 pt-5 sm:px-8 lg:px-11 lg:pt-8">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3 lg:hidden"><span className="text-2xl">🌱</span><span className="font-black">KosaKata</span></div>
            <div className="hidden sm:block"><p className="text-sm font-bold text-slate-400">Rabu, 18 November 2026</p><p className="mt-1 text-xl font-black">Hai, Sahabat Pintar! 👋</p></div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm"><Flame size={17} className="fill-orange-400 text-orange-400" /><span className="text-sm font-extrabold">3 hari</span></div>
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#FFE7A3] text-lg">🧒</div>
            </div>
          </header>

          {page === 'home' && <HomePage onStart={() => setPage('learn')} onQuiz={startQuiz} onCategory={chooseCategory} />}
          {page === 'learn' && word && <LearnPage category={category} word={word} words={words} currentWord={currentWord} showMeaning={showMeaning} saved={savedWords.includes(word.id)} onFlip={() => setShowMeaning((shown) => !shown)} onNext={() => { setCurrentWord((index) => (index + 1) % words.length); setShowMeaning(false) }} onSave={() => toggleSaved(word.id)} onCategory={chooseCategory} />}
          {page === 'quiz' && <QuizPage word={quizWord} options={options} selected={selectedAnswer} score={quizScore} onAnswer={answerQuiz} onNext={nextQuestion} onBack={() => setPage('home')} />}

          <footer className="mt-10 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-400"><span>Made with</span><Heart size={13} className="fill-[#FF8B77] text-[#FF8B77]" /><span>untuk belajar yang menyenangkan</span><span className="mx-1">·</span><span>{isSupabaseConfigured ? 'Terhubung ke Supabase' : 'Mode demo — data contoh'}</span></footer>
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-slate-100 bg-white/95 px-4 py-2 backdrop-blur lg:hidden">
        <MobileNav icon={<Home size={20} />} label="Beranda" active={page === 'home'} onClick={() => setPage('home')} />
        <MobileNav icon={<BookOpen size={20} />} label="Kartu kata" active={page === 'learn'} onClick={() => setPage('learn')} />
        <MobileNav icon={<CircleHelp size={20} />} label="Kuis" active={page === 'quiz'} onClick={startQuiz} />
      </nav>
    </div>
  )
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-extrabold transition ${active ? 'bg-[#E7F6ED] text-[#318A60]' : 'text-slate-500 hover:bg-slate-50'}`}>{icon}{label}</button>
}

function MobileNav({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex min-w-[78px] flex-col items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-extrabold ${active ? 'text-[#318A60]' : 'text-slate-400'}`}>{icon}{label}</button>
}

function HomePage({ onStart, onQuiz, onCategory }: { onStart: () => void; onQuiz: () => void; onCategory: (id: string) => void }) {
  return <>
    <section className="relative overflow-hidden rounded-[30px] bg-[#DDF5E9] px-6 py-8 sm:px-10 sm:py-10">
      <div className="relative z-[1] max-w-[520px]">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-xs font-extrabold text-[#438765]"><Sparkles size={14} /> WAKTUNYA BELAJAR!</div>
        <h1 className="text-[32px] font-black leading-[1.13] tracking-tight sm:text-[42px]">Yuk, tambah <span className="text-[#33875D]">kosakata</span> hari ini!</h1>
        <p className="mt-3 max-w-[410px] text-sm font-semibold leading-6 text-[#567665] sm:text-base">Belajar kata-kata bahasa Inggris baru dengan cara yang seru dan gampang diingat.</p>
        <div className="mt-6 flex flex-wrap gap-3"><button onClick={onStart} className="inline-flex items-center gap-2 rounded-2xl bg-[#32875D] px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-green-900/10 transition hover:-translate-y-0.5">Mulai belajar <ChevronRight size={17} /></button><button onClick={onQuiz} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-extrabold text-ink transition hover:bg-slate-50"><Star size={16} className="text-amber-400" /> Coba kuis</button></div>
      </div>
      <div className="pointer-events-none absolute -right-2 bottom-[-38px] hidden text-[145px] drop-shadow-sm float-gently sm:block">🦊</div>
      <div className="absolute right-[25%] top-8 text-2xl">✨</div><div className="absolute bottom-7 right-[13%] text-2xl">🌼</div>
    </section>

    <section className="mt-8">
      <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Pilih kesukaanmu</p><h2 className="mt-1 text-xl font-black">Jelajahi kategori</h2></div><button onClick={onStart} className="text-xs font-extrabold text-[#318A60]">Lihat semua</button></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {SAMPLE_CATEGORIES.map((item, index) => <button key={item.id} onClick={() => { onCategory(item.id); onStart() }} className={`group rounded-[24px] ${categoryStyles[item.color] ?? 'bg-white'} p-4 text-left transition hover:-translate-y-1 hover:shadow-soft sm:p-5`}><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/80 text-2xl shadow-sm">{item.emoji}</span><span className="mt-4 block font-black">{item.name}</span><span className="mt-1 block text-xs font-bold text-slate-500">{[12, 8, 15, 10][index]} kata seru</span></button>)}
      </div>
    </section>

    <section className="mt-8 grid gap-4 md:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-[26px] bg-white p-5 shadow-soft sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Lanjutkan belajar</p><h2 className="mt-1 text-lg font-black">Kata pilihan hari ini</h2></div><span className="rounded-xl bg-[#FFF2C9] p-2 text-xl">💡</span></div><div className="mt-5 flex items-center gap-4 rounded-2xl bg-[#F8FAF8] p-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#E4F4EB] text-3xl">🦋</span><div className="min-w-0 flex-1"><p className="text-lg font-black">Butterfly</p><p className="text-sm font-semibold text-slate-400">Kupu-kupu · ba-ter-flai</p></div><button onClick={onStart} aria-label="Mulai belajar" className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#398B62] shadow-sm"><ChevronRight size={19} /></button></div></div>
      <div className="flex items-center gap-4 rounded-[26px] bg-[#FFF1D6] p-5 sm:p-6"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/80 text-3xl">🏆</span><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#AA8450]">Hebat sekali!</p><p className="mt-1 text-lg font-black">Kamu makin pintar</p><p className="mt-1 text-xs font-semibold leading-5 text-[#8F7853]">Terus berlatih dan kumpulkan bintangmu.</p></div></div>
    </section>
  </>
}

function LearnPage({ category, word, words, currentWord, showMeaning, saved, onFlip, onNext, onSave, onCategory }: { category: { name: string; emoji: string }; word: Vocabulary; words: Vocabulary[]; currentWord: number; showMeaning: boolean; saved: boolean; onFlip: () => void; onNext: () => void; onSave: () => void; onCategory: (id: string) => void }) {
  return <section className="mx-auto max-w-3xl">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Kartu kata</p><h1 className="mt-1 text-2xl font-black">Belajar kosakata 🌟</h1></div><select aria-label="Pilih kategori" value={category.name === 'Hewan' ? 'animals' : category.name === 'Makanan' ? 'food' : category.name === 'Sekolah' ? 'school' : 'nature'} onChange={(event) => onCategory(event.target.value)} className="rounded-xl border-0 bg-white px-4 py-3 text-sm font-extrabold shadow-sm outline-none">{SAMPLE_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select></div>
    <div className="mb-5 flex items-center justify-between"><span className="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-slate-500">{category.emoji} {category.name}</span><span className="text-xs font-extrabold text-slate-400">{currentWord + 1} dari {words.length} kata</span></div>
    <button onClick={onFlip} className="group relative flex min-h-[330px] w-full flex-col items-center justify-center overflow-hidden rounded-[32px] bg-white p-8 text-center shadow-soft transition hover:shadow-lg sm:min-h-[390px]">
      <span className="absolute left-6 top-6 rounded-full bg-[#F2F8F4] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#5F9876]">{showMeaning ? 'Artinya dalam bahasa Indonesia' : 'Bahasa Inggris'}</span>
      <span className="mb-5 text-7xl transition group-hover:scale-110">{word.emoji}</span>
      <span className="text-4xl font-black tracking-tight sm:text-5xl">{showMeaning ? word.indonesian : word.english}</span>
      <span className="mt-3 text-sm font-bold text-slate-400">{showMeaning ? word.english : word.pronunciation}</span>
      {showMeaning && <span className="mt-5 rounded-xl bg-[#F5F9F6] px-4 py-2 text-sm font-semibold italic text-slate-500">“{word.example}”</span>}
      <span className="absolute bottom-5 text-xs font-bold text-slate-300">Ketuk kartu untuk {showMeaning ? 'kembali' : 'melihat arti'}</span>
    </button>
    <div className="mt-5 flex justify-center gap-3"><button onClick={onSave} className={`grid h-12 w-12 place-items-center rounded-2xl border border-slate-100 bg-white ${saved ? 'text-rose-500' : 'text-slate-400'}`} aria-label={saved ? 'Hapus dari favorit' : 'Simpan ke favorit'}><Heart size={20} className={saved ? 'fill-rose-500' : ''} /></button><button onClick={onFlip} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 font-extrabold shadow-sm"><Volume2 size={18} className="text-[#398B62]" /> Lihat arti</button><button onClick={onNext} className="inline-flex items-center gap-2 rounded-2xl bg-[#32875D] px-6 font-extrabold text-white shadow-sm">Kata berikutnya <ChevronRight size={17} /></button></div>
    <div className="mt-6 flex justify-center gap-1.5">{words.map((item, index) => <span key={item.id} className={`h-1.5 rounded-full transition-all ${index === currentWord ? 'w-8 bg-[#53B47D]' : 'w-3 bg-[#DBE8DF]'}`} />)}</div>
  </section>
}

function QuizPage({ word, options, selected, score, onAnswer, onNext, onBack }: { word: Vocabulary; options: Vocabulary[]; selected: string | null; score: number; onAnswer: (answer: string) => void; onNext: () => void; onBack: () => void }) {
  return <section className="mx-auto max-w-2xl">
    <div className="mb-6 flex items-end justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Kuis seru</p><h1 className="mt-1 text-2xl font-black">Ayo tebak artinya! 🎯</h1></div><span className="rounded-full bg-[#FFF1D6] px-4 py-2 text-sm font-extrabold text-[#A77C37]">⭐ {score} benar</span></div>
    <div className="rounded-[30px] bg-white p-6 shadow-soft sm:p-9"><div className="mb-6 flex items-center justify-between"><span className="rounded-full bg-[#F2F8F4] px-3 py-2 text-xs font-extrabold text-[#5F9876]">Pilih jawaban yang benar</span><span className="text-sm font-extrabold text-slate-400"><Headphones size={16} className="mr-1 inline" /> Dengar & pilih</span></div><div className="rounded-[24px] bg-[#EAF7EF] py-8 text-center"><div className="text-6xl">{word.emoji}</div><h2 className="mt-3 text-3xl font-black">{word.english}</h2><p className="mt-1 text-sm font-bold text-slate-400">{word.pronunciation}</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{options.map((option) => { const correct = option.indonesian === word.indonesian; const chosen = selected === option.indonesian; return <button key={option.id} onClick={() => onAnswer(option.indonesian)} className={`flex items-center justify-between rounded-2xl border-2 px-4 py-4 text-left font-extrabold transition ${selected ? correct ? 'border-[#70C796] bg-[#EAF7EF] text-[#32875D]' : chosen ? 'border-[#FF9D8D] bg-[#FFF0ED] text-[#C65F4F]' : 'border-slate-100 text-slate-400' : 'border-slate-100 bg-white hover:border-[#9BDAB4] hover:bg-[#F6FBF8]'}`}><span>{option.indonesian}</span>{selected && correct && <Check size={18} />}</button> })}</div>{selected && <div className={`mt-4 rounded-2xl p-4 text-sm font-extrabold ${selected === word.indonesian ? 'bg-[#EAF7EF] text-[#32875D]' : 'bg-[#FFF0ED] text-[#C65F4F]'}`}>{selected === word.indonesian ? 'Yeay, jawabanmu benar! Hebat! 🎉' : `Belum tepat. ${word.english} artinya ${word.indonesian}. Yuk coba lagi!`}</div>}<div className="mt-6 flex justify-between"><button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold text-slate-400"><RotateCcw size={16} /> Kembali</button>{selected && <button onClick={onNext} className="inline-flex items-center gap-2 rounded-xl bg-[#32875D] px-5 py-3 text-sm font-extrabold text-white">Lanjut <ChevronRight size={16} /></button>}</div></div>
  </section>
}

export default App

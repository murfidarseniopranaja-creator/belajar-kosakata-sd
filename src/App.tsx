import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, CircleHelp, Crown, GraduationCap, HelpCircle, Home, Lightbulb, Medal, PenTool, RefreshCw, RotateCcw, Shuffle, Sparkles, Trophy, Volume2, XCircle, Loader2, Globe, CloudDownload } from 'lucide-react'
import { SAMPLE_CATEGORIES, SAMPLE_VOCABULARY, supabase, type Category, type QuizScore, type Vocabulary } from './lib/supabase'

type Page = 'home' | 'learn' | 'practice' | 'quiz' | 'leaderboard'
type QuizMode = 'multiple-choice' | 'written' | 'mixed'
type Question = { word: Vocabulary; mode: 'multiple-choice' | 'written'; options: Vocabulary[] }
const GRADES = [1, 2, 3, 4, 5, 6]
const COLORS: Record<string, string> = { mint: 'bg-[#DDF5E9]', sunshine: 'bg-[#FFE7A3]', lavender: 'bg-[#E9E2FF]', coral: 'bg-[#FFE0D9]' }
const MODES: { value: QuizMode; label: string }[] = [
  { value: 'multiple-choice', label: 'Pilihan Ganda (50 Soal)' },
  { value: 'written', label: 'Tebak Gambar — Tulis Bahasa Inggris (50 Soal)' },
  { value: 'mixed', label: 'Campuran: Pilihan Ganda + Tulis Jawaban (50 Soal)' },
]
const TOPICS: Record<string, string> = {
  hewan: 'animals',
  'buah & makanan': 'food,fruit',
  keluarga: 'family',
  'benda di sekolah': 'school,classroom',
  'warna & angka': 'colors,numbers',
}
const EMOJI_BY_TOPIC: Record<string, string> = {
  hewan: '🐾', 'buah & makanan': '🍎', keluarga: '👨‍👩‍👧‍👦', 'benda di sekolah': '🎒', 'warna & angka': '🎨',
}

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
function normalizeWord(row: Partial<Vocabulary> | null | undefined): Vocabulary {
  return { id: row?.id ?? '', category_id: row?.category_id ?? '', grade_level: Number(row?.grade_level ?? 1), word_en: row?.word_en ?? '', phonetic: row?.phonetic ?? '', word_id: row?.word_id ?? '', example_en: row?.example_en ?? '', example_id: row?.example_id ?? '', image_emoji: row?.image_emoji ?? '' }
}
function normalizeScore(row: Partial<QuizScore> | null | undefined): QuizScore {
  return { id: row?.id, student_name: row?.student_name ?? 'Siswa', grade_level: Number(row?.grade_level ?? 1), category_name: row?.category_name ?? '', score: Number(row?.score ?? 0), total_questions: Number(row?.total_questions ?? 0), created_at: row?.created_at }
}
async function translateToIndonesian(text: string): Promise<string> {
  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|id`)
    if (!response.ok) return ''
    const result = await response.json() as { responseData?: { translatedText?: string } }
    return result.responseData?.translatedText ?? ''
  } catch { return '' }
}
async function getOnlineWord(word: string, categoryId: string, grade: number, emoji: string): Promise<Vocabulary | null> {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
    if (!response.ok) return null
    const data = await response.json() as Array<{ phonetics?: Array<{ text?: string }>; meanings?: Array<{ definitions?: Array<{ example?: string }> }> }>
    const entry = data?.[0]
    const phonetic = entry?.phonetics?.find((item) => item?.text)?.text ?? ''
    const example = entry?.meanings?.flatMap((meaning) => meaning?.definitions ?? []).find((definition) => definition?.example)?.example ?? `I learn the word ${word} at school.`
    const [translation, exampleTranslation] = await Promise.all([translateToIndonesian(word), translateToIndonesian(example)])
    return { id: `online-${word.toLowerCase()}`, category_id: categoryId, grade_level: grade, word_en: word, phonetic, word_id: translation || word, example_en: example, example_id: exampleTranslation, image_emoji: emoji }
  } catch { return null }
}
async function fetchOnlineVocabularies(categoryName: string, categoryId: string, grade: number, current: Vocabulary[]): Promise<Vocabulary[]> {
  const normalized = categoryName.trim().toLowerCase()
  const topics = TOPICS[normalized] ?? 'nature,home,elementary'
  try {
    const response = await fetch(`https://api.datamuse.com/words?topics=${encodeURIComponent(topics)}&md=f&max=40`)
    if (!response.ok) return []
    const results = await response.json() as Array<{ word?: string }>
    const known = new Set(current.map((item) => (item?.word_en ?? '').trim().toLowerCase()))
    const fresh = results.map((item) => item?.word ?? '').filter((word) => /^[a-z]{3,10}$/.test(word) && !known.has(word.toLowerCase())).slice(0, 15)
    const emoji = EMOJI_BY_TOPIC[normalized] ?? '📘'
    const created: Vocabulary[] = []
    for (let offset = 0; offset < fresh.length; offset += 5) {
      const batch = await Promise.allSettled(fresh.slice(offset, offset + 5).map((word) => getOnlineWord(word, categoryId, grade, emoji)))
      batch.forEach((result) => { if (result.status === 'fulfilled' && result.value) created.push(result.value) })
    }
    return created
  } catch { return [] }
}
function makeQuestions(pool: Vocabulary[], all: Vocabulary[], mode: QuizMode): Question[] {
  if (!all.length) return []
  const list = shuffle(pool.length ? pool : all).slice(0, 50)
  while (list.length < 50) list.push(all[Math.floor(Math.random() * all.length)])
  return list.map((word, index) => {
    const kind = mode === 'mixed' ? (index % 2 === 0 ? 'multiple-choice' : 'written') : mode
    const distractors = shuffle(all.filter((item) => item.id !== word.id && (item.word_id ?? '').toLowerCase() !== (word.word_id ?? '').toLowerCase())).slice(0, 3)
    return { word, mode: kind, options: shuffle([word, ...distractors]) }
  })
}

function App() {
  const [page, setPage] = useState<Page>('home')
  const [categories, setCategories] = useState<Category[]>(SAMPLE_CATEGORIES)
  const [words, setWords] = useState<Vocabulary[]>(SAMPLE_VOCABULARY)
  const [scores, setScores] = useState<QuizScore[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [grade, setGrade] = useState(1)
  const [studentName, setStudentName] = useState('')
  const [wordIndex, setWordIndex] = useState(0)
  const [studyDone, setStudyDone] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [onlineSource, setOnlineSource] = useState(true)
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [onlineNotice, setOnlineNotice] = useState('')
  const [quizMode, setQuizMode] = useState<QuizMode>('multiple-choice')
  const [quizStarted, setQuizStarted] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answer, setAnswer] = useState<string | null>(null)
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [scoreSaved, setScoreSaved] = useState(false)
  const [writtenAnswer, setWrittenAnswer] = useState('')
  const [practiceGrade, setPracticeGrade] = useState<number | null>(null)
  const [practiceCategory, setPracticeCategory] = useState('')
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [practiceInput, setPracticeInput] = useState('')
  const [practiceChecked, setPracticeChecked] = useState(false)
  const [practiceCorrect, setPracticeCorrect] = useState<boolean | null>(null)
  const [hint, setHint] = useState(false)
  const [practicePool, setPracticePool] = useState<Vocabulary[]>([])
  const [practiceTimer, setPracticeTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [speaking, setSpeaking] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(supabase))
  const [scoresLoading, setScoresLoading] = useState(false)
  const [noticeTimer, setNoticeTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const speechRun = useRef(0)
  const onlineAttempted = useRef(false)
  const practiceInputRef = useRef<HTMLInputElement>(null)

  const clearSpeechTimers = () => {
    if (speechTimer.current) clearTimeout(speechTimer.current)
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
    speechTimer.current = null; advanceTimer.current = null; countdownTimer.current = null; setCountdown(null)
  }
  const cancelSpeech = () => {
    speechRun.current += 1
    clearSpeechTimers()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(null)
  }

  useEffect(() => {
    let mounted = true
    async function loadData() {
      if (!supabase) { setLoading(false); setError('Supabase belum dikonfigurasi. Data contoh ditampilkan.'); return }
      try {
        const [categoryResult, wordResult] = await Promise.all([
          supabase.from('categories').select('id, name_en, name_id, icon_emoji, color_theme, sort_order').order('sort_order', { ascending: true }),
          supabase.from('vocabularies').select('id, category_id, grade_level, word_en, phonetic, word_id, example_en, example_id, image_emoji').order('word_en', { ascending: true }),
        ])
        if (!mounted) return
        if (categoryResult.error || wordResult.error) setError(categoryResult.error?.message ?? wordResult.error?.message ?? 'Gagal memuat Supabase.')
        else {
          const categoryRows = (categoryResult.data ?? []).map(normalizeCategory)
          const wordRows = (wordResult.data ?? []).map(normalizeWord)
          setCategories(categoryRows.length ? categoryRows : SAMPLE_CATEGORIES)
          setWords(wordRows.length ? wordRows : SAMPLE_VOCABULARY)
          setError('')
        }
      } catch (loadError) { if (mounted) setError(loadError instanceof Error ? loadError.message : String(loadError ?? '')) }
      finally { if (mounted) setLoading(false) }
    }
    void loadData()
    return () => { mounted = false }
  }, [])

  const loadScores = async () => {
    if (!supabase) { setScores([]); return }
    setScoresLoading(true)
    try {
      const { data, error: queryError } = await supabase.from('quiz_scores').select('*').order('score', { ascending: false }).order('created_at', { ascending: false }).limit(20)
      if (queryError) { setError(queryError.message); return }
      setScores((data ?? []).map(normalizeScore)); setError('')
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : String(loadError ?? '')) }
    finally { setScoresLoading(false) }
  }
  useEffect(() => {
    void loadScores()
    if (!supabase) return
    const channel = supabase.channel('quiz-scores').on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_scores' }, () => { void loadScores() }).subscribe()
    return () => { if (supabase) void supabase.removeChannel(channel) }
  }, [])
  useEffect(() => {
    cancelSpeech()
    return () => {
      speechRun.current += 1
      if (speechTimer.current) clearTimeout(speechTimer.current)
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
      if (countdownTimer.current) clearInterval(countdownTimer.current)
      if (practiceTimer) clearTimeout(practiceTimer)
      if (noticeTimer) clearTimeout(noticeTimer)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [page, categoryId, wordIndex, practiceIndex])

  const safeCategories = categories ?? []
  const safeWords = words ?? []
  const category = safeCategories.find((item) => item?.id === categoryId) ?? null
  const visibleWords = useMemo(() => safeWords.filter((item) => Number(item?.grade_level ?? grade) === grade && (!categoryId || item?.category_id === categoryId)), [safeWords, categoryId, grade])
  const studyWord = visibleWords[wordIndex]
  const practiceWords = useMemo(() => safeWords.filter((item) => (practiceGrade === null || Number(item?.grade_level ?? 0) === practiceGrade) && (!practiceCategory || item?.category_id === practiceCategory)), [safeWords, practiceGrade, practiceCategory])
  const currentPractice = practicePool.length ? practicePool[practiceIndex % practicePool.length] : practiceWords[practiceIndex % Math.max(practiceWords.length, 1)]
  const question = questions[questionIndex]
  const quizWord = question?.word

  const loadOnlineWords = useCallback(async (targetCategoryId: string, showNotice = true) => {
    if (!onlineSource || onlineLoading) return
    setOnlineLoading(true)
    const targetCategory = safeCategories.find((item) => item.id === targetCategoryId) ?? null
    const name = targetCategory?.name_id ?? ''
    const newWords = await fetchOnlineVocabularies(name, targetCategoryId || 'nature', grade, safeWords)
    if (newWords.length) {
      setWords((current) => [...current, ...newWords.filter((item) => !current.some((existing) => (existing.word_en ?? '').toLowerCase() === (item.word_en ?? '').toLowerCase()))])
      if (supabase) void supabase.from('vocabularies').insert(newWords).then(() => undefined).catch(() => undefined)
      if (showNotice) {
        setOnlineNotice(`+${newWords.length} kosakata online baru dimuat`)
        if (noticeTimer) clearTimeout(noticeTimer)
        setNoticeTimer(setTimeout(() => setOnlineNotice(''), 3500))
      }
    } else if (showNotice) {
      setOnlineNotice('Tidak ada kosakata online baru untuk filter ini.')
      if (noticeTimer) clearTimeout(noticeTimer)
      setNoticeTimer(setTimeout(() => setOnlineNotice(''), 3000))
    }
    setOnlineLoading(false)
  }, [onlineSource, onlineLoading, safeCategories, grade, safeWords, noticeTimer])

  useEffect(() => {
    if (!onlineSource || loading || onlineAttempted.current) return
    const count = safeWords.filter((item) => (!categoryId || item?.category_id === categoryId) && Number(item?.grade_level ?? grade) === grade).length
    if (count < 5) {
      onlineAttempted.current = true
      void loadOnlineWords(categoryId, false)
    }
  }, [onlineSource, loading, categoryId, grade, safeWords, loadOnlineWords])

  const speakSequence = (parts: { text: string; lang: string; rate: number }[], done?: () => void) => {
    cancelSpeech()
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { done?.(); return }
    const run = speechRun.current
    let index = 0
    const speakNext = () => {
      if (speechRun.current !== run) return
      const part = parts[index]
      if (!part) { setSpeaking(null); done?.(); return }
      const utterance = new SpeechSynthesisUtterance(part.text ?? '')
      utterance.lang = part.lang
      utterance.rate = part.rate
      utterance.onstart = () => setSpeaking(`${run}-${index}`)
      utterance.onend = () => { index += 1; speakNext() }
      utterance.onerror = () => { index += 1; speakNext() }
      window.speechSynthesis.speak(utterance)
    }
    speakNext()
  }
  const speak = (text: string | null | undefined, id: string) => {
    cancelSpeech()
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const phrase = text ?? ''
    const run = speechRun.current
    const utterance = new SpeechSynthesisUtterance(phrase)
    utterance.lang = 'en-US'; utterance.rate = 0.85
    let ended = false
    const onEnd = () => {
      if (ended || speechRun.current !== run) return
      ended = true
      if (speechTimer.current) clearTimeout(speechTimer.current)
      speechTimer.current = null
      setSpeaking(null)
      if (!autoAdvance || page !== 'learn') return
      setCountdown(2)
      countdownTimer.current = setInterval(() => setCountdown((value) => value === null || value <= 1 ? 0 : value - 1), 1000)
      advanceTimer.current = setTimeout(() => {
        if (countdownTimer.current) clearInterval(countdownTimer.current)
        countdownTimer.current = null; advanceTimer.current = null; setCountdown(null)
        if (speechRun.current === run) advanceWord()
      }, 2000)
    }
    utterance.onstart = () => setSpeaking(id)
    utterance.onend = onEnd; utterance.onerror = onEnd
    setSpeaking(id); window.speechSynthesis.speak(utterance)
    speechTimer.current = setTimeout(onEnd, Math.max(2500, phrase.length / 12 * 1000))
  }

  const advanceWord = () => { cancelSpeech(); if (wordIndex + 1 >= visibleWords.length) setStudyDone(true); else setWordIndex((value) => value + 1) }
  const startExam = () => {
    if (!studentName.trim()) { document.getElementById('exam-student-name')?.focus(); setError('Silakan isi nama siswa sebelum memulai ujian.'); return }
    const selected = safeWords.filter((item) => Number(item?.grade_level ?? 0) === grade && (!categoryId || item?.category_id === categoryId))
    const selectedIds = new Set(selected.map((item) => item?.id))
    const pool = shuffle([...shuffle(selected), ...shuffle(safeWords.filter((item) => !selectedIds.has(item?.id)))])
    while (pool.length && pool.length < 50) pool.push(safeWords[Math.floor(Math.random() * safeWords.length)])
    const built = makeQuestions(pool.slice(0, 50), safeWords, quizMode)
    if (!built.length) { setError('Belum ada kosakata yang tersedia untuk ujian ini.'); return }
    cancelSpeech(); setQuestions(built); setQuestionIndex(0); setScore(0); setAnswer(null); setWrittenAnswer(''); setAnswerCorrect(null); setSubmitted(false); setFinished(false); setScoreSaved(false); setQuizStarted(true); setError('')
  }
  const submitAnswer = (value: string) => {
    if (submitted || !quizWord) return
    const expected = question?.mode === 'written' ? quizWord.word_en ?? '' : quizWord.word_id ?? ''
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
  const nextQuestion = () => { if (!submitted) return; if (questionIndex + 1 >= questions.length) { void finishExam(); return }; setQuestionIndex((index) => index + 1); setAnswer(null); setWrittenAnswer(''); setAnswerCorrect(null); setSubmitted(false) }
  const goTo = (target: Page) => { cancelSpeech(); setPage(target) }
  const selectCategory = (id: string) => { cancelSpeech(); setCategoryId(id); setWordIndex(0); setStudyDone(false) }
  const practiceNext = () => {
    cancelSpeech(); if (practiceTimer) clearTimeout(practiceTimer)
    setPracticeTimer(null); setPracticeInput(''); setPracticeChecked(false); setPracticeCorrect(null); setHint(false)
    setPracticeIndex((value) => practiceWords.length ? (value + 1) % practiceWords.length : 0)
    window.setTimeout(() => practiceInputRef.current?.focus(), 0)
  }
  const practiceCheck = () => {
    if (!currentPractice || practiceChecked || !practiceInput.trim()) return
    if (practiceTimer) clearTimeout(practiceTimer)
    const isCorrect = practiceInput.trim().toLowerCase() === (currentPractice.word_en ?? '').trim().toLowerCase()
    setPracticeChecked(true); setPracticeCorrect(isCorrect)
    const english = currentPractice.word_en ?? ''; const idWord = currentPractice.word_id ?? ''
    if (isCorrect) speakSequence([{ text: 'Hebat! Jawabanmu benar.', lang: 'id-ID', rate: .95 }, { text: english, lang: 'en-US', rate: .85 }], () => setPracticeTimer(setTimeout(practiceNext, 2500)))
    else speakSequence([{ text: `Belum tepat. Bahasa Inggrisnya ${idWord} adalah ${english}, dieja ${english.toUpperCase().split('').join(', ')}`, lang: 'id-ID', rate: .95 }, { text: english, lang: 'en-US', rate: .85 }])
  }
  const practiceShuffle = () => { cancelSpeech(); const filtered = safeWords.filter((item) => (practiceGrade === null || Number(item?.grade_level ?? 0) === practiceGrade) && (!practiceCategory || item?.category_id === practiceCategory)); setPracticePool(shuffle(filtered)); setPracticeIndex(0); setPracticeInput(''); setPracticeChecked(false); setPracticeCorrect(null); setHint(false) }
  const loadOnline = async () => {
    if (!onlineSource || onlineLoading) return
    setOnlineLoading(true)
    const name = safeCategories.find((item) => item.id === categoryId)?.name_id ?? ''
    const topics = TOPICS[name.trim().toLowerCase()] ?? 'nature,home,elementary'
    let created: Vocabulary[] = []
    try {
      const res = await fetch(`https://api.datamuse.com/words?topics=${encodeURIComponent(topics)}&md=f&max=40`)
      const list = res.ok ? await res.json() as Array<{ word?: string }> : []
      const exists = new Set(safeWords.map((item) => (item?.word_en ?? '').toLowerCase()))
      const candidates = list.map((item) => item.word ?? '').filter((w) => /^[a-z]{3,10}$/.test(w) && !exists.has(w.toLowerCase())).slice(0, 15)
      const emoji = EMOJI_BY_TOPIC[name.trim().toLowerCase()] ?? '📘'
      for (let start = 0; start < candidates.length; start += 5) {
        const settled = await Promise.allSettled(candidates.slice(start, start + 5).map(async (w) => {
          const dictResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`)
          if (!dictResponse.ok) return null
          const dictionary = await dictResponse.json() as Array<{ phonetics?: Array<{ text?: string }>; meanings?: Array<{ definitions?: Array<{ example?: string }> }> }>
          const entry = dictionary?.[0]
          const phonetic = entry?.phonetics?.find((p) => p?.text)?.text ?? ''
          const example = entry?.meanings?.flatMap((m) => m?.definitions ?? []).find((d) => d?.example)?.example ?? `I learn the word ${w} at school.`
          const translate = async (text: string) => {
            try {
              const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|id`)
              const data = response.ok ? await response.json() as { responseData?: { translatedText?: string } } : {}
              return data.responseData?.translatedText ?? ''
            } catch { return '' }
          }
          const [wordId, exampleId] = await Promise.all([translate(w), translate(example)])
          return normalizeWord({ id: `online-${w}`, category_id: categoryId || 'nature', grade_level: grade, word_en: w, phonetic, word_id: wordId || w, example_en: example, example_id: exampleId, image_emoji: emoji })
        }))
        settled.forEach((item) => { if (item.status === 'fulfilled' && item.value) created.push(item.value) })
      }
    } catch { /* Online services are optional; keep local and Supabase words available. */ }
    if (created.length) {
      setWords((old) => [...old, ...created.filter((item) => !old.some((entry) => entry.word_en.toLowerCase() === item.word_en.toLowerCase()))])
      if (supabase) void supabase.from('vocabularies').insert(created).then(() => undefined).catch(() => undefined)
      setOnlineNotice(`+${created.length} kosakata online baru dimuat`)
      if (noticeTimer) clearTimeout(noticeTimer)
      setNoticeTimer(setTimeout(() => setOnlineNotice(''), 3500))
    } else setOnlineNotice('Tidak ada kosakata online baru untuk filter ini.')
    setOnlineLoading(false)
  }

  useEffect(() => {
    if (!onlineSource || loading || onlineAttempted.current) return
    const count = safeWords.filter((item) => (!categoryId || item.category_id === categoryId) && Number(item.grade_level ?? grade) === grade).length
    if (count < 5) { onlineAttempted.current = true; void loadOnline() }
  }, [onlineSource, loading, categoryId, grade, safeWords])

  return <div className="min-h-screen bg-[#F6FBF8] pb-20 text-[#25334A]"><header className="mx-auto flex max-w-5xl items-center justify-between p-5"><button onClick={() => goTo('home')} className="flex items-center gap-2 text-xl font-black">🌱 KosaKata</button><label className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-bold"><GraduationCap size={18}/><select value={grade} onChange={(e) => setGrade(Number(e.target.value))} className="bg-transparent">{GRADES.map((item) => <option key={item} value={item}>Kelas {item} SD</option>)}</select></label></header>
    <main className="mx-auto max-w-5xl px-4 pb-8">{error && <p role="status" className="mb-4 rounded-2xl bg-amber-100 p-4 font-bold">{error}</p>}{onlineNotice && <p role="status" className="mb-4 rounded-2xl bg-green-100 p-3 font-bold text-green-800">{onlineNotice}</p>}{loading && <p className="mb-4 font-bold">Memuat data…</p>}
      <nav className="mb-6 flex flex-wrap gap-2"><PageButton active={page === 'home'} onClick={() => goTo('home')} icon={<Home size={17}/>} label="Beranda"/><PageButton active={page === 'learn'} onClick={() => { setStudyDone(false); goTo('learn') }} icon={<BookOpen size={17}/>} label="Kartu kata"/><PageButton active={page === 'practice'} onClick={() => goTo('practice')} icon={<PenTool size={17}/>} label="Latihan"/><PageButton active={page === 'quiz'} onClick={() => { cancelSpeech(); setPage('quiz'); setQuizStarted(false) }} icon={<HelpCircle size={17}/>} label="Ujian"/><PageButton active={page === 'leaderboard'} onClick={() => { goTo('leaderboard'); void loadScores() }} icon={<Trophy size={17}/>} label="Papan skor"/></nav>
      {page === 'home' && <section className="space-y-7"><div className="rounded-[30px] bg-[#DDF5E9] p-8"><p className="font-black text-[#32875D]"><Sparkles className="inline"/> WAKTUNYA BELAJAR!</p><h1 className="mt-3 text-4xl font-black">Yuk, belajar kosakata Inggris!</h1></div><label className="block rounded-2xl bg-white p-5 font-bold">Nama siswa<input id="exam-student-name" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Nama siswa" className="mt-2 block w-full rounded-xl border p-3"/></label><CategoryButtons categories={safeCategories} selected={categoryId} onSelect={selectCategory}/></section>}
      {page === 'learn' && <section><div className="mb-4 flex flex-wrap items-center justify-between"><h1 className="text-3xl font-black">Kartu kata</h1><OnlineControls online={onlineSource} setOnline={setOnlineSource} loading={onlineLoading} onLoad={loadOnline}/></div><CategoryButtons categories={safeCategories} selected={categoryId} onSelect={selectCategory}/>{studyDone ? <div className="mt-5 rounded-3xl bg-white p-8 text-center"><h2 className="text-2xl font-black">Hebat! Daftar selesai.</h2><button onClick={() => { setStudyDone(false); setWordIndex(0) }} className="m-2 rounded-xl bg-[#FFF1D6] p-3">Ulangi Daftar Kata</button><button onClick={nextStudyPage} className="m-2 rounded-xl bg-green-700 p-3 text-white">Lanjut ke Latihan</button></div> : studyWord ? <article className="mt-5 rounded-3xl bg-white p-7 text-center"><div className="text-8xl">{studyWord.image_emoji ?? ''}</div><h2 className="mt-3 text-4xl font-black">{studyWord.word_en}</h2><p>{studyWord.phonetic ?? ''}</p><p className="text-xl font-bold">{studyWord.word_id ?? ''}</p><div className="mt-4 flex justify-center gap-4"><SpeakButton text={studyWord.word_en} id="study-word" active={speaking} speak={speak}/><span>{studyWord.example_en}</span><SpeakButton text={studyWord.example_en} id="study-example" active={speaking} speak={speak}/></div><p>{studyWord.example_id ?? ''}</p>{countdown !== null && <p>Otomatis lanjut dalam {countdown} detik...</p>}<button onClick={() => speak(studyWord.word_en, 'repeat')} className="m-3 rounded-xl bg-amber-100 p-3"><RotateCcw/> Ulangi</button><button onClick={advanceWord} className="rounded-xl bg-green-700 p-3 text-white">Lanjut <ArrowRight/></button></article> : <p>Belum ada kata.</p>}</section>}
      {page === 'practice' && <section><div className="mb-4 flex flex-wrap items-center justify-between"><div><h1 className="text-3xl font-black">Latihan</h1><p>Menulis Bahasa Inggris — latihan bebas, skor tidak disimpan.</p></div><OnlineControls online={onlineSource} setOnline={setOnlineSource} loading={onlineLoading} onLoad={loadOnline}/></div><div className="mb-5 grid gap-3 sm:grid-cols-2"><label className="font-bold">Kelas<select value={practiceGrade ?? ''} onChange={(e) => { setPracticeGrade(e.target.value ? Number(e.target.value) : null); setPracticePool([]); setPracticeIndex(0) }} className="mt-1 block w-full rounded-xl bg-white p-3"><option value="">Semua Kelas</option>{GRADES.map((g) => <option key={g} value={g}>Kelas {g} SD</option>)}</select></label><label className="font-bold">Kategori<select value={practiceCategory} onChange={(e) => { setPracticeCategory(e.target.value); setPracticePool([]); setPracticeIndex(0) }} className="mt-1 block w-full rounded-xl bg-white p-3"><option value="">Semua Kategori</option>{safeCategories.map((c) => <option key={c.id} value={c.id}>{c.name_id}</option>)}</select></label></div><button onClick={shufflePractice} className="mb-4 rounded-xl bg-green-700 p-3 text-white"><Shuffle/> Acak Soal</button><PracticeCard word={currentPractice} index={practiceIndex} total={practicePool.length || practiceWords.length} input={practiceInput} setInput={setPracticeInput} checked={practiceChecked} correct={practiceCorrect} hint={hint} setHint={setHint} check={practiceCheck} next={practiceNext} retry={() => { setPracticeInput(''); setPracticeChecked(false); setPracticeCorrect(null); practiceInputRef.current?.focus() }} inputRef={practiceInputRef} speaking={speaking} speak={speak} speakSequence={speakSequence}/></section>}
      {page === 'quiz' && <ExamPanel started={quizStarted} start={() => { setQuizStarted(false) }} startExam={startExam} name={studentName} setName={setStudentName} grade={grade} setGrade={setGrade} categories={safeCategories} categoryId={categoryId} setCategoryId={setCategoryId} mode={quizMode} setMode={setQuizMode} questions={questions} index={questionIndex} score={score} finished={finished} scoreSaved={scoreSaved} question={question} answer={answer} submitted={submitted} correct={answerCorrect} written={writtenAnswer} setWritten={setWrittenAnswer} submit={submitAnswer} next={nextQuestion} speak={speak} speaking={speaking} leaderboard={() => { setPage('leaderboard'); void loadScores() }}/>}>
      {page === 'leaderboard' && <section className="rounded-3xl bg-white p-6"><div className="mb-4 flex items-center justify-between"><h1 className="text-3xl font-black"><Trophy/> Papan Skor</h1><button onClick={() => void loadScores()} disabled={scoresLoading} className="rounded-xl bg-green-100 p-3"><RefreshCw className={scoresLoading ? 'animate-spin' : ''}/></button></div>{scoresLoading && <p>Memuat…</p>}{scores.map((item, index) => <p key={item.id ?? index} className="border-t p-3">{index + 1}. {item.student_name} · Kelas {item.grade_level} · {item.category_name} · {item.score}/{item.total_questions}</p>)}</section>}
    </main></div>
}

function OnlineControls({ online, setOnline, loading, onLoad }: { online: boolean; setOnline: (value: boolean) => void; loading: boolean; onLoad: () => void }) {
  return <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} className="accent-green-700"/>Database + Online</label><button onClick={onLoad} disabled={!online || loading} className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={17}/> : <Globe size={17}/>} {loading ? 'Memuat kata…' : 'Muat Kata Online'}</button></div>
}
function PracticeCard({ word, index, total, input, setInput, checked, correct, hint, setHint, check, next, retry, inputRef, speaking, speak, speakSequence }: { word?: Vocabulary; index: number; total: number; input: string; setInput: (v: string) => void; checked: boolean; correct: boolean | null; hint: boolean; setHint: (v: boolean) => void; check: () => void; next: () => void; retry: () => void; inputRef: React.RefObject<HTMLInputElement>; speaking: string | null; speak: (text: string | null | undefined, id: string) => void; speakSequence: (parts: { text: string; lang: string; rate: number }[], done?: () => void) => void }) {
  if (!word) return <p className="rounded-2xl bg-white p-6">Belum ada kosakata untuk filter ini.</p>
  const english = word.word_en ?? ''
  const first = english ? english[0].toUpperCase() : ''
  const hintText = `${first}${english.slice(1).split('').map(() => ' _').join('')} (${english.length} huruf)`
  return <article className="mt-4 rounded-3xl bg-white p-6 text-center shadow"><p>Soal {index + 1} dari {total}</p><div className="text-[120px]">{word.image_emoji ?? ''}</div><p className="text-2xl font-black">{word.word_id ?? ''}</p><div className="mt-3 flex justify-center gap-3"><button onClick={() => setHint(true)} className="inline-flex items-center gap-2 rounded-xl bg-amber-100 p-3 font-bold"><Lightbulb/> Petunjuk Huruf</button><SpeakButton text={english} id={`practice-${word.id}`} active={speaking} speak={speak}/></div>{hint && <p className="mt-3 font-mono text-lg font-black text-green-700">{hintText}</p>}<form onSubmit={(e) => { e.preventDefault(); check() }} className="mx-auto mt-5 flex max-w-xl flex-col gap-3 sm:flex-row"><input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} disabled={checked} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="min-h-14 flex-1 rounded-xl border-2 px-4 text-lg" placeholder="Ketik kata bahasa Inggris"/><button disabled={checked || !input.trim()} className="rounded-xl bg-green-700 px-5 font-bold text-white disabled:opacity-40">Periksa Jawaban</button></form>{checked && (correct ? <div className="mt-4 rounded-xl bg-green-50 p-4 font-bold text-green-800"><CheckCircle2 className="inline"/> Hebat! Jawabanmu Benar! <button onClick={() => speakSequence([{ text: 'Hebat! Jawabanmu benar.', lang: 'id-ID', rate: .95 }, { text: english, lang: 'en-US', rate: .85 }])}><Volume2/></button><button onClick={next} className="ml-3 rounded-lg bg-green-700 p-2 text-white">Soal Berikutnya</button><small className="ml-2">Otomatis lanjut dalam 2,5 detik</small></div> : <div className="mt-4 rounded-xl border-2 border-orange-200 bg-orange-50 p-4 text-left"><p>Jawabanmu: <s className="text-red-600">{input}</s></p><p className="mt-2 text-3xl font-black text-green-700">{english}</p><p className="font-mono font-bold">{english.toUpperCase().split('').join(' - ')}</p><p>Cara baca: {word.phonetic ?? ''}</p><div className="mt-3 flex gap-2"><button onClick={retry} className="rounded-lg bg-amber-100 p-3"><RotateCcw/> Tulis Ulang Jawaban</button><button onClick={next} className="rounded-lg bg-green-700 p-3 text-white">Soal Berikutnya <ArrowRight/></button></div></div>)}</article>
}
function ExamPanel({ started, start, startExam, name, setName, grade, setGrade, categories, categoryId, setCategoryId, mode, setMode, questions, index, score, finished, scoreSaved, question, answer, submitted, correct, written, setWritten, submit, next, speak, speaking, leaderboard }: { started: boolean; start: () => void; startExam: () => void; name: string; setName: (s: string) => void; grade: number; setGrade: (n: number) => void; categories: Category[]; categoryId: string; setCategoryId: (s: string) => void; mode: QuizMode; setMode: (m: QuizMode) => void; questions: Question[]; index: number; score: number; finished: boolean; scoreSaved: boolean; question?: Question; answer: string | null; submitted: boolean; correct: boolean | null; written: string; setWritten: (s: string) => void; submit: (s: string) => void; next: () => void; speak: (s: string | null | undefined, id: string) => void; speaking: string | null; leaderboard: () => void }) {
  const word = question?.word
  if (finished) return <div className="text-center"><Trophy size={52}/><h1 className="mt-3 text-3xl font-black">Hebat, {name || 'Siswa'}!</h1><p className="mt-2 text-xl font-bold">Skor {score}/{questions.length}</p><p>{scoreSaved ? 'Skor tersimpan!' : 'Skor belum tersimpan.'}</p><button onClick={leaderboard} className="mt-4 rounded-xl bg-amber-100 p-3">Lihat Papan Skor</button></div>
  if (!started) return <div><h1 className="text-3xl font-black">Persiapan Ujian</h1><label className="mt-4 block font-bold">Nama siswa<input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border p-3" placeholder="Nama wajib diisi"/></label><p className="mt-4 font-bold">Kelas</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{GRADES.map((g) => <button key={g} onClick={() => setGrade(g)} className={`rounded-xl p-3 ${grade === g ? 'bg-green-700 text-white' : 'bg-amber-100'}`}>Kelas {g} SD</button>)}</div><label className="mt-4 block font-bold">Kategori<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-2 w-full rounded-xl border p-3"><option value="">Semua Kategori</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name_id}</option>)}</select></label><label className="mt-4 block font-bold">Mode ujian<select value={mode} onChange={(e) => setMode(e.target.value as QuizMode)} className="mt-2 w-full rounded-xl border p-3">{MODES.map((m) => <option value={m.value} key={m.value}>{m.label}</option>)}</select></label><button onClick={startExam} className="mt-5 w-full rounded-xl bg-green-700 p-3 font-bold text-white">Mulai Ujian</button></div>
  if (!question || !word) return <p>Tidak ada kosakata untuk ujian.</p>
  return <div><div className="flex justify-between"><h2 className="text-2xl font-black">Soal {index + 1}/{questions.length}</h2><b>⭐ {score}</b></div>{question.mode === 'multiple-choice' ? <><div className="my-5 flex items-center justify-center gap-4 rounded-xl bg-slate-50 p-5"><span className="text-5xl">{word.image_emoji ?? ''}</span><b className="text-3xl">{word.word_en}</b><SpeakButton text={word.word_en} id={`exam-${word.id}`} active={speaking} speak={speak}/></div><div className="grid gap-3 sm:grid-cols-2">{question.options.map((option, i) => <button key={`${index}-${option.id}-${i}`} disabled={submitted} onClick={() => submit(option.word_id ?? '')} className="rounded-xl border-2 p-3 text-left disabled:bg-green-50"><b>{String.fromCharCode(65 + i)}.</b> {option.word_id}</button>)}</div></> : <div className="my-5 rounded-xl bg-slate-50 p-5 text-center"><p className="text-8xl">{word.image_emoji ?? ''}</p><p className="text-xl font-bold">{word.word_id}</p><SpeakButton text={word.word_en} id={`exam-written-${word.id}`} active={speaking} speak={speak}/><form onSubmit={(e) => { e.preventDefault(); submit(written) }} className="mt-4 flex gap-2"><input value={written} onChange={(e) => setWritten(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={submitted} className="min-h-12 flex-1 rounded-lg border p-3"/><button disabled={submitted} className="rounded-lg bg-green-700 px-4 text-white">Periksa Jawaban</button></form></div>}{submitted && <div className={`mt-4 rounded-xl p-4 font-bold ${correct ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{correct ? <CheckCircle2 className="inline"/> : <XCircle className="inline"/>} {correct ? 'Benar!' : `Salah, jawaban: ${word.word_en}`} {!correct && <button onClick={() => speak(word.word_en, `feedback-${word.id}`)}><Volume2/></button>}<button onClick={next} className="ml-4 rounded bg-green-700 p-2 text-white">{index + 1 === questions.length ? 'Hasil' : 'Berikutnya'}</button></div>}</div>
}
function PageButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) { return <button onClick={onClick} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-bold ${active ? 'bg-[#32875D] text-white' : 'bg-white text-slate-600'}`}>{icon}{label}</button> }
function CategoryButtons({ categories, selected, onSelect }: { categories: Category[]; selected: string; onSelect: (id: string) => void }) { return <div className="flex flex-wrap gap-2"><button onClick={() => onSelect('')} className={`rounded-xl px-4 py-2 font-bold ${!selected ? 'bg-green-700 text-white' : 'bg-white'}`}>Semua</button>{(categories ?? []).map((c, i) => { const name = c?.name_id || c?.name_en || ''; const color = COLORS[c?.color_theme ?? ''] ?? 'bg-white'; return <button key={c?.id ?? i} onClick={() => onSelect(c?.id ?? '')} className={`rounded-xl px-4 py-2 font-bold ${selected === c?.id ? 'bg-green-700 text-white' : color}`}>{c?.icon_emoji ?? ''} {name}</button> })}</div> }
function SpeakButton({ text, id, active, speak }: { text: string | null | undefined; id: string; active: string | null; speak: (text: string | null | undefined, id: string) => void }) { return <button type="button" aria-label={`Dengarkan ${text ?? ''}`} onClick={() => speak(text, id)} className={`grid h-12 w-12 place-items-center rounded-xl ${active === id ? 'animate-pulse bg-green-700 text-white' : 'bg-green-100 text-green-700'}`}><Volume2 size={21}/></button> }
export default App

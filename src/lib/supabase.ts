import { createClient } from '@supabase/supabase-js'

export interface Category {
  id: string
  name_en: string | null
  name_id: string | null
  icon_emoji: string | null
  color_theme: string | null
  sort_order: number | null
}

export interface Vocabulary {
  id: string
  category_id: string | null
  grade_level: number | null
  word_en: string | null
  phonetic: string | null
  word_id: string | null
  example_en: string | null
  example_id: string | null
  image_emoji: string | null
  created_at?: string | null
}

export interface QuizScore {
  id?: string
  student_name: string | null
  grade_level: number | null
  category_name: string | null
  score: number | null
  total_questions: number | null
  created_at?: string | null
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabaseUrl = rawUrl.startsWith('https://') ? rawUrl : ''
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)?.trim() ?? ''

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null

export const SAMPLE_CATEGORIES: Category[] = [
  { id: 'animals', name_en: 'Animals', name_id: 'Hewan', icon_emoji: '🐼', color_theme: 'mint', sort_order: 1 },
  { id: 'food', name_en: 'Food', name_id: 'Makanan', icon_emoji: '🍓', color_theme: 'sunshine', sort_order: 2 },
  { id: 'school', name_en: 'School', name_id: 'Sekolah', icon_emoji: '✏️', color_theme: 'lavender', sort_order: 3 },
  { id: 'nature', name_en: 'Nature', name_id: 'Alam', icon_emoji: '🌈', color_theme: 'coral', sort_order: 4 },
]

export const SAMPLE_VOCABULARY: Vocabulary[] = [
  { id: 'v1', category_id: 'animals', grade_level: 1, word_en: 'Butterfly', phonetic: 'ba-ter-flai', word_id: 'Kupu-kupu', example_en: 'A butterfly is colorful.', example_id: 'Kupu-kupu berwarna-warni.', image_emoji: '🦋' },
  { id: 'v2', category_id: 'animals', grade_level: 1, word_en: 'Rabbit', phonetic: 'ra-bit', word_id: 'Kelinci', example_en: 'The rabbit can hop.', example_id: 'Kelinci itu bisa melompat.', image_emoji: '🐰' },
  { id: 'v3', category_id: 'animals', grade_level: 1, word_en: 'Elephant', phonetic: 'e-le-fent', word_id: 'Gajah', example_en: 'An elephant is big.', example_id: 'Gajah itu besar.', image_emoji: '🐘' },
  { id: 'v4', category_id: 'animals', grade_level: 2, word_en: 'Turtle', phonetic: 'ter-tel', word_id: 'Kura-kura', example_en: 'The turtle walks slowly.', example_id: 'Kura-kura berjalan perlahan.', image_emoji: '🐢' },
  { id: 'v5', category_id: 'food', grade_level: 1, word_en: 'Strawberry', phonetic: 'stro-be-ri', word_id: 'Stroberi', example_en: 'I like strawberry jam.', example_id: 'Saya suka selai stroberi.', image_emoji: '🍓' },
  { id: 'v6', category_id: 'food', grade_level: 2, word_en: 'Carrot', phonetic: 'ke-ret', word_id: 'Wortel', example_en: 'Rabbits like carrots.', example_id: 'Kelinci suka wortel.', image_emoji: '🥕' },
  { id: 'v7', category_id: 'food', grade_level: 1, word_en: 'Bread', phonetic: 'bred', word_id: 'Roti', example_en: 'I eat bread for breakfast.', example_id: 'Saya makan roti untuk sarapan.', image_emoji: '🍞' },
  { id: 'v8', category_id: 'school', grade_level: 1, word_en: 'Pencil', phonetic: 'pen-sil', word_id: 'Pensil', example_en: 'I write with a pencil.', example_id: 'Saya menulis dengan pensil.', image_emoji: '✏️' },
  { id: 'v9', category_id: 'school', grade_level: 1, word_en: 'Book', phonetic: 'buk', word_id: 'Buku', example_en: 'This is my favorite book.', example_id: 'Ini buku kesukaan saya.', image_emoji: '📚' },
  { id: 'v10', category_id: 'school', grade_level: 2, word_en: 'Teacher', phonetic: 'ti-cer', word_id: 'Guru', example_en: 'My teacher is kind.', example_id: 'Guru saya baik.', image_emoji: '👩‍🏫' },
  { id: 'v11', category_id: 'nature', grade_level: 1, word_en: 'Rainbow', phonetic: 'rein-bou', word_id: 'Pelangi', example_en: 'A rainbow has many colors.', example_id: 'Pelangi memiliki banyak warna.', image_emoji: '🌈' },
  { id: 'v12', category_id: 'nature', grade_level: 2, word_en: 'Flower', phonetic: 'flau-er', word_id: 'Bunga', example_en: 'The flower smells sweet.', example_id: 'Bunga itu berbau harum.', image_emoji: '🌼' },
]

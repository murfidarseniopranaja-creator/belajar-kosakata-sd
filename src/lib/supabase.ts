import { createClient } from '@supabase/supabase-js'

export interface Category {
  id: string
  name: string
  emoji: string
  color: string
  sort_order: number
  created_at?: string
}

export interface Vocabulary {
  id: string
  category_id: string
  english: string
  indonesian: string
  pronunciation: string
  example: string
  emoji: string
  created_at?: string
}

export interface QuizScore {
  id?: string
  player_name: string
  score: number
  total_questions: number
  category_id: string | null
  created_at?: string
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// The client stays null in local/demo mode so the app works without credentials.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const SAMPLE_CATEGORIES: Category[] = [
  { id: 'animals', name: 'Hewan', emoji: '🐼', color: 'mint', sort_order: 1 },
  { id: 'food', name: 'Makanan', emoji: '🍓', color: 'sunshine', sort_order: 2 },
  { id: 'school', name: 'Sekolah', emoji: '✏️', color: 'lavender', sort_order: 3 },
  { id: 'nature', name: 'Alam', emoji: '🌈', color: 'coral', sort_order: 4 },
]

export const SAMPLE_VOCABULARY: Vocabulary[] = [
  { id: 'v1', category_id: 'animals', english: 'Butterfly', indonesian: 'Kupu-kupu', pronunciation: 'ba-ter-flai', example: 'A butterfly is colorful.', emoji: '🦋' },
  { id: 'v2', category_id: 'animals', english: 'Rabbit', indonesian: 'Kelinci', pronunciation: 'ra-bit', example: 'The rabbit can hop.', emoji: '🐰' },
  { id: 'v3', category_id: 'animals', english: 'Elephant', indonesian: 'Gajah', pronunciation: 'e-le-fent', example: 'An elephant is big.', emoji: '🐘' },
  { id: 'v4', category_id: 'animals', english: 'Turtle', indonesian: 'Kura-kura', pronunciation: 'ter-tel', example: 'The turtle walks slowly.', emoji: '🐢' },
  { id: 'v5', category_id: 'food', english: 'Strawberry', indonesian: 'Stroberi', pronunciation: 'stro-be-ri', example: 'I like strawberry jam.', emoji: '🍓' },
  { id: 'v6', category_id: 'food', english: 'Carrot', indonesian: 'Wortel', pronunciation: 'ke-ret', example: 'Rabbits like carrots.', emoji: '🥕' },
  { id: 'v7', category_id: 'food', english: 'Bread', indonesian: 'Roti', pronunciation: 'bred', example: 'I eat bread for breakfast.', emoji: '🍞' },
  { id: 'v8', category_id: 'school', english: 'Pencil', indonesian: 'Pensil', pronunciation: 'pen-sil', example: 'I write with a pencil.', emoji: '✏️' },
  { id: 'v9', category_id: 'school', english: 'Book', indonesian: 'Buku', pronunciation: 'buk', example: 'This is my favorite book.', emoji: '📚' },
  { id: 'v10', category_id: 'school', english: 'Teacher', indonesian: 'Guru', pronunciation: 'ti-cer', example: 'My teacher is kind.', emoji: '👩‍🏫' },
  { id: 'v11', category_id: 'nature', english: 'Rainbow', indonesian: 'Pelangi', pronunciation: 'rein-bou', example: 'A rainbow has many colors.', emoji: '🌈' },
  { id: 'v12', category_id: 'nature', english: 'Flower', indonesian: 'Bunga', pronunciation: 'flau-er', example: 'The flower smells sweet.', emoji: '🌼' },
]

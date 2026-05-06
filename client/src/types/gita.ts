export interface SynopsisSection {
  heading: string;
  paragraphs: string[];
}

export interface ChapterMeta {
  chapter: number;
  name: string;
  name_hindi: string;
  devanagari_name?: string;
  iast_name?: string;
  subtitle: string;
  verses_count: number;
  summary: string;
  generated_description?: string;
  theme: string;
  color: string;
  icon: string;
  key_verses: Verse[];
  synopsis_content?: {
    sections: SynopsisSection[];
  };
}

export interface VerseImage {
  url: string;
  caption?: string;
}

export interface GrammarWord {
  word: string;
  anta?: string;
  linga?: string;
  vibhakti?: string;
  vacanam?: string;
  type?: string;
  dhatu?: string;
  lakara?: string;
}

export interface RichGrammar {
  padacchedah?: string;
  pratipadarthah?: string;
  padaparicayah?: GrammarWord[];
  anvayah?: string;
  sandhi?: string;
  samasa?: string;
  other?: string;
}

export interface KidsContent {
  explanation_script?: string;
  story?: string;
  reflection?: string;
}

export interface Verse {
  verse: number;
  chapter: number;
  title?: string;
  audio_url?: string;
  sanskrit: string;
  transliteration: string;
  one_line_meaning: string;
  concise_journey: string;
  full_journey_text?: string;
  story?: string;
  real_life_example?: string;
  final_takeaway?: string;
  grammar_notes?: string;
  // Rich content fields (used for detailed verses like Ch12V1)
  meaning_detail?: string;
  reflection?: string;
  kids_content?: KidsContent;
  detailed_meaning?: string;
  more_stories?: string;
  rich_grammar?: RichGrammar;
  // Section images keyed by section name
  images?: {
    meaning?: VerseImage;
    story?: VerseImage[];
    modern_life?: VerseImage;
    kids_explain?: VerseImage;
    kids_story?: VerseImage;
    detailed_meaning?: VerseImage;
    more_stories?: VerseImage[];
    grammar?: VerseImage;
  };
}

export interface GitaData {
  chapters: ChapterMeta[];
  chapter6_full: Verse[];
}

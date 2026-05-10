/** Verse to feature under “Suggested verses” for a topic hub (resolved against gitaData). */
export interface TopicSuggestedVerse {
  chapter: number;
  verse: number;
}

export interface TopicHub {
  slug: string;
  title: string;
  shortDescription: string;
  primaryKeywords: string[];
  chapterNumbers: number[];
  /** Curated picks per hub so each life-topic page shows distinct verses (not always the first two in chapter order). */
  suggestedVerses: TopicSuggestedVerse[];
}

export const TOPIC_HUBS: TopicHub[] = [
  {
    slug: "anxiety-stress-mental-health",
    title: "Gita for Anxiety, Stress, and Mental Health",
    shortDescription: "Verses and teachings for calmness, resilience, and emotional balance.",
    primaryKeywords: [
      "Bhagavad Gita for anxiety",
      "Gita for stress management",
      "Bhagavad Gita for mental peace",
      "Gita anxiety relief",
    ],
    // Until additional chapters are editorially ready, topic hubs intentionally point only to Chapter 12.
    // When onboarding a new chapter, update these mappings and run the chapter SEO rollout checklist.
    chapterNumbers: [12],
    // Ch.12 editorial mapping (meaning_detail + reflection + detailed_meaning): difficulty of the subtle path and
    // body-identified mind (5); rescue from mortality/saṃsāra as existential dread (7); not disturbing others / not
    // shaken by the world, explicitly freeing fear and anxiety (15); freedom from dependence and binding expectation (16).
    suggestedVerses: [
      { chapter: 12, verse: 5 },
      { chapter: 12, verse: 7 },
      { chapter: 12, verse: 15 },
      { chapter: 12, verse: 16 },
    ],
  },
  {
    slug: "decision-making-dharma",
    title: "Gita for Decision Making and Dharma",
    shortDescription: "Teachings for duty, ethics, and difficult life choices.",
    primaryKeywords: [
      "Bhagavad Gita decision making",
      "what is dharma",
      "duty vs desire in Gita",
      "guidance for tough decisions",
    ],
    chapterNumbers: [3, 12],
    // Ch.3: Arjuna's dharma confusion (1); renunciation alone doesn't liberate (4); perform prescribed duty (8).
    // Two valid orientations (saguṇa vs nirguṇa) without mere comparison (1); karma-phala offered as prasāda in ordinary life (11);
    // practical sama-buddhi toward friend and foe, honor and dishonor—action from dharma not rāga-dveṣa (18); the chapter’s
    // dharmyāmṛta conclusion—living immortal dharma with śraddhā and parama goal (20).
    suggestedVerses: [
      { chapter: 3, verse: 1 },
      { chapter: 3, verse: 4 },
      { chapter: 3, verse: 8 },
      { chapter: 12, verse: 1 },
      { chapter: 12, verse: 11 },
      { chapter: 12, verse: 18 },
      { chapter: 12, verse: 20 },
    ],
  },
  {
    slug: "focus-productivity-karma-yoga",
    title: "Gita for Focus, Productivity, and Karma Yoga",
    shortDescription: "Action-oriented verses to build discipline and focus without anxiety.",
    primaryKeywords: [
      "karma yoga explained",
      "focus on action not results",
      "Bhagavad Gita productivity",
      "Gita for focus",
    ],
    chapterNumbers: [3, 12],
    // Ch.3: The true karma yogī regulates senses and acts without attachment (7); perform prescribed duty (8); action as yajña offering (9).
    // Ladder of accessible practice: dedicate all action to Īśvara (6); abhyāsa on iṣṭa-devatā when Viśvarūpa is too wide (9);
    // mat-karma as worship when meditation is not yet stable (10); śānti through karma-phala-tyāga vs mechanical practice / jñāna / dhyāna (12).
    suggestedVerses: [
      { chapter: 3, verse: 7 },
      { chapter: 3, verse: 8 },
      { chapter: 3, verse: 9 },
      { chapter: 12, verse: 6 },
      { chapter: 12, verse: 9 },
      { chapter: 12, verse: 10 },
      { chapter: 12, verse: 12 },
    ],
  },
  {
    slug: "philosophy-spiritual-wisdom",
    title: "Gita Philosophy and Spiritual Wisdom",
    shortDescription: "Core teachings on self, karma, devotion, and purpose of life.",
    primaryKeywords: [
      "essence of Bhagavad Gita",
      "Gita core teachings",
      "practical spirituality",
      "meaning of life in Bhagavad Gita",
    ],
    chapterNumbers: [3, 12],
    // Ch.3: Two lifestyles (karma-pradhāna and jñāna-pradhāna) as Vedic order (3); Veda born from Brahman (15); the self-fulfilled jñānī (17).
    // Metaphysical arc of the opening answer: niṣkāma saguṇa upāsanā as highest yoga in Arjuna’s terms (2); nirguṇa akṣara as
    // avyakta / acintya / anirdeśya (3); inner qualifications for that subtle contemplation—indriya-jaya and sama-buddhi (4);
    // Viśvarūpa conviction—buddhi + manas fixed on “cause–effect” non-duality of the world and Īśvara (8).
    suggestedVerses: [
      { chapter: 3, verse: 3 },
      { chapter: 3, verse: 15 },
      { chapter: 3, verse: 17 },
      { chapter: 12, verse: 2 },
      { chapter: 12, verse: 3 },
      { chapter: 12, verse: 4 },
      { chapter: 12, verse: 8 },
    ],
  },
];

const DEFAULT_TERMS = ["bhakti", "karma", "focus", "peace", "spirituality"];

const CHAPTER_INTENT_TERMS: Record<number, string[]> = {
  1: ["inner conflict", "stress", "dharma", "decision making", "purpose"],
  2: ["karma yoga", "focus", "mental peace", "detachment", "duty"],
  3: ["karma", "discipline", "productivity", "duty vs desire", "selfless action"],
  4: ["spiritual wisdom", "divine knowledge", "karma", "purpose", "self-realization"],
  5: ["inner peace", "renunciation", "karma yoga", "balance", "calm mind"],
  6: ["meditation", "focus", "mind control", "anxiety relief", "mental strength"],
  7: ["devotion", "knowledge", "spirituality", "God", "purpose of life"],
  8: ["death and afterlife", "spiritual focus", "detachment", "purpose", "God remembrance"],
  9: ["bhakti", "devotion", "faith", "spiritual lifestyle", "divine love"],
  10: ["Krishna teachings", "spiritual wisdom", "divine qualities", "devotion", "focus"],
  11: ["Vishvarupa", "surrender", "fear and courage", "spiritual awe", "Krishna vision"],
  12: ["bhakti", "devotion", "peace", "focus", "spiritual love"],
  13: ["self knowledge", "body and soul", "spirituality", "wisdom", "detachment"],
  14: ["guna balance", "mental health", "self-control", "clarity", "inner stability"],
  15: ["purpose of life", "soul", "detachment", "divine wisdom", "spiritual focus"],
  16: ["ethical living", "self-improvement", "character", "decision making", "dharma"],
  17: ["faith", "lifestyle", "discipline", "spiritual growth", "focus"],
  18: ["dharma", "karma", "peace", "surrender", "life direction"],
};

export function getChapterIntentTerms(chapterNum: number): string[] {
  return CHAPTER_INTENT_TERMS[chapterNum] || DEFAULT_TERMS;
}

export function getTopicHubsForChapter(chapterNum: number): TopicHub[] {
  return TOPIC_HUBS.filter((hub) => hub.chapterNumbers.includes(chapterNum));
}


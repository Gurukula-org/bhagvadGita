export interface TopicHub {
  slug: string;
  title: string;
  shortDescription: string;
  primaryKeywords: string[];
  chapterNumbers: number[];
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
    chapterNumbers: [12],
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
    chapterNumbers: [12],
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
    chapterNumbers: [12],
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


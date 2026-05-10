// Verse Match Game — Flip cards to match Sanskrit shloka with its meaning
import { useState, useEffect, useCallback } from "react";
import { splitVerseLines } from "@/lib/transliterationDisplay";
import {
  getChapter6Verses,
  pickRandom,
  getScoreEmoji,
  getScoreMessage,
} from "./gameData";
import { RotateCcw, Trophy } from "lucide-react";

interface MatchCard {
  id: string;
  content: string;
  type: "sanskrit" | "meaning";
  pairId: number;
  isFlipped: boolean;
  isMatched: boolean;
}

interface Props {
  chapterNum: number;
}

function buildCards(count = 5): MatchCard[] {
  const verses = pickRandom(getChapter6Verses(), count);
  const cards: MatchCard[] = [];
  verses.forEach((v, i) => {
    const sanskrit = splitVerseLines(v.sanskrit)[0].replace(/॥.*॥/, "").trim();
    cards.push({
      id: `s-${i}`,
      content: sanskrit,
      type: "sanskrit",
      pairId: i,
      isFlipped: false,
      isMatched: false,
    });
    const meaning =
      v.one_line_meaning.length > 90
        ? v.one_line_meaning.slice(0, 90) + "…"
        : v.one_line_meaning;
    cards.push({
      id: `m-${i}`,
      content: meaning,
      type: "meaning",
      pairId: i,
      isFlipped: false,
      isMatched: false,
    });
  });
  return cards.sort(() => Math.random() - 0.5);
}

export default function VerseMatchGame({ chapterNum: _ }: Props) {
  const [cards, setCards] = useState<MatchCard[]>(() => buildCards(5));
  const [selected, setSelected] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [wrongPair, setWrongPair] = useState<string[]>([]);

  const totalPairs = cards.length / 2;

  const resetGame = useCallback(() => {
    setCards(buildCards(5));
    setSelected([]);
    setMoves(0);
    setMatchedCount(0);
    setIsChecking(false);
    setGameOver(false);
    setWrongPair([]);
  }, []);

  const handleCardClick = (cardId: string) => {
    if (isChecking) return;
    const card = cards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched) return;
    if (selected.includes(cardId)) return;

    const newSelected = [...selected, cardId];
    setCards(prev =>
      prev.map(c => (c.id === cardId ? { ...c, isFlipped: true } : c))
    );
    setSelected(newSelected);

    if (newSelected.length === 2) {
      setMoves(m => m + 1);
      setIsChecking(true);
      const [first, second] = newSelected.map(
        id => cards.find(c => c.id === id)!
      );

      setTimeout(() => {
        if (first.pairId === second.pairId) {
          // Match!
          setCards(prev =>
            prev.map(c =>
              c.id === first.id || c.id === second.id
                ? { ...c, isMatched: true }
                : c
            )
          );
          const newCount = matchedCount + 1;
          setMatchedCount(newCount);
          if (newCount === totalPairs) setGameOver(true);
        } else {
          // No match — flip back
          setWrongPair([first.id, second.id]);
          setTimeout(() => {
            setCards(prev =>
              prev.map(c =>
                c.id === first.id || c.id === second.id
                  ? { ...c, isFlipped: false }
                  : c
              )
            );
            setWrongPair([]);
          }, 800);
        }
        setSelected([]);
        setIsChecking(false);
      }, 600);
    }
  };

  if (gameOver) {
    const emoji = getScoreEmoji(totalPairs, totalPairs);
    const msg =
      moves <= totalPairs + 2
        ? "Incredible memory!"
        : moves <= totalPairs * 2
          ? "Well done!"
          : "You did it!";
    return (
      <div className="text-center py-8 px-4">
        <div className="text-6xl mb-4">{emoji}</div>
        <h3 className="font-kids font-bold text-2xl text-red-900 mb-2">
          All Matched! 🎉
        </h3>
        <p className="text-red-700 font-kids text-lg mb-1">{msg}</p>
        <p className="text-gray-600 font-kids mb-6">
          You matched all {totalPairs} pairs in <strong>{moves} moves</strong>!
        </p>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 text-left">
          <p className="text-orange-800 font-kids font-bold text-sm mb-2">
            🌟 What you learned:
          </p>
          <p className="text-orange-700 font-kids text-sm">
            You matched {totalPairs} Sanskrit shlokas from Chapter 6 with their
            meanings. Great job learning the Bhagavad Gita!
          </p>
        </div>
        <button
          onClick={resetGame}
          className="flex items-center gap-2 mx-auto bg-violet-600 hover:bg-violet-500 text-white font-kids font-bold px-6 py-3 rounded-full transition-all shadow-md"
        >
          <RotateCcw size={16} />
          Play Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-2">
      {/* Stats */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-3">
          <div className="bg-violet-100 text-violet-700 font-kids font-bold px-3 py-1 rounded-full text-sm">
            Moves: {moves}
          </div>
          <div className="bg-green-100 text-green-700 font-kids font-bold px-3 py-1 rounded-full text-sm">
            Matched: {matchedCount}/{totalPairs}
          </div>
        </div>
        <button
          onClick={resetGame}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Instructions */}
      <p className="text-center text-gray-600 font-kids text-sm mb-4">
        Tap a card to flip it! Match the Sanskrit shloka 🕉 with its meaning 💡
      </p>

      {/* Card Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {cards.map(card => {
          const isWrong = wrongPair.includes(card.id);
          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              disabled={card.isMatched || card.isFlipped}
              className={`
                relative min-h-[90px] sm:min-h-[100px] rounded-xl p-3 text-left transition-all duration-300 border-2
                ${
                  card.isMatched
                    ? "bg-green-100 border-green-400 cursor-default scale-95"
                    : card.isFlipped
                      ? isWrong
                        ? "bg-red-100 border-red-400"
                        : card.type === "sanskrit"
                          ? "bg-red-100 border-orange-400"
                          : "bg-orange-100 border-orange-400"
                      : "bg-white border-gray-200 hover:border-violet-300 hover:shadow-md active:scale-95"
                }
              `}
            >
              {!card.isFlipped && !card.isMatched ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-3xl opacity-40">
                    {card.type === "sanskrit" ? "🕉" : "💡"}
                  </span>
                </div>
              ) : (
                <div>
                  {card.isMatched && (
                    <span className="absolute top-1 right-1 text-green-500 text-xs">
                      ✓
                    </span>
                  )}
                  <div
                    className={`text-xs font-bold mb-1 uppercase tracking-wide ${
                      card.type === "sanskrit"
                        ? "text-red-800"
                        : "text-orange-600"
                    }`}
                  >
                    {card.type === "sanskrit" ? "🕉 Sanskrit" : "💡 Meaning"}
                  </div>
                  <p
                    className={`text-xs leading-relaxed ${
                      card.type === "sanskrit"
                        ? "font-devanagari text-red-900 text-sm"
                        : "font-kids text-gray-800"
                    }`}
                  >
                    {card.content}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400 font-kids mt-4">
        Tip: First flip a Sanskrit card 🕉, then find its matching meaning 💡
      </p>
    </div>
  );
}

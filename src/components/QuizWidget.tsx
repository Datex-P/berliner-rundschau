"use client";

import { useState, useCallback } from "react";
import type { Quiz } from "@/types";

interface QuizWidgetProps {
  data: Quiz;
}

export default function QuizWidget({ data }: QuizWidgetProps) {
  const { dailyQuiz } = data ?? {};
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!dailyQuiz?.questions?.length) return null;

  const question = dailyQuiz.questions[currentIndex];
  const isAnswered = selectedOption !== null;
  const isCorrect = selectedOption === question?.correctIndex;
  const total = dailyQuiz.questions.length;

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (isAnswered) return;
      setSelectedOption(optionIndex);
      if (optionIndex === question.correctIndex) {
        setScore((prev) => prev + 1);
      }
    },
    [isAnswered, question?.correctIndex],
  );

  const handleNext = useCallback(() => {
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
    } else {
      setFinished(true);
    }
  }, [currentIndex, total]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setScore(0);
    setFinished(false);
  }, []);

  if (finished) {
    return (
      <section aria-labelledby="quiz-heading">
        <h3
          id="quiz-heading"
          className="text-lg font-bold font-heading text-(--color-text) mb-4 pb-2 border-b-2 border-(--color-accent)"
        >
          Tagesquiz
        </h3>
        <div className="text-center py-4" role="status">
          <p className="text-2xl font-bold text-(--color-text) mb-1">
            {score} / {total}
          </p>
          <p className="text-sm text-(--color-text-secondary) mb-4">
            {score === total
              ? "Perfekt! Alle richtig!"
              : score >= total / 2
                ? "Gut gemacht!"
                : "Nächstes Mal besser!"}
          </p>
          <button
            type="button"
            onClick={handleRestart}
            className="px-4 py-2 text-sm font-medium bg-(--color-primary) text-(--color-on-primary) rounded-lg hover:bg-(--color-primary-hover) transition-colors"
          >
            Nochmal spielen
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="quiz-heading">
      <h3
        id="quiz-heading"
        className="text-lg font-bold font-heading text-(--color-text) mb-4 pb-2 border-b-2 border-(--color-accent)"
      >
        Tagesquiz
      </h3>
      <div>
        <p className="text-xs text-(--color-text-tertiary) mb-2">
          Frage {currentIndex + 1} von {total}
        </p>
        <p className="text-sm font-medium text-(--color-text) mb-3">
          {question.question}
        </p>
        <div className="space-y-2" role="radiogroup" aria-label="Antworten">
          {question.options.map((option, i) => {
            let variant =
              "bg-(--color-surface) border-(--color-border) hover:border-(--color-primary)";
            if (isAnswered) {
              if (i === question.correctIndex) {
                variant =
                  "bg-(--color-success-light) border-(--color-success) text-(--color-success-text)";
              } else if (i === selectedOption) {
                variant =
                  "bg-(--color-error-light) border-(--color-error) text-(--color-error-text)";
              } else {
                variant =
                  "bg-(--color-surface) border-(--color-border) opacity-50";
              }
            }
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selectedOption === i}
                disabled={isAnswered}
                onClick={() => handleSelect(i)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors ${variant}`}
              >
                {option}
              </button>
            );
          })}
        </div>
        {isAnswered && (
          <div className="mt-3">
            <p
              className={`text-xs mb-2 ${isCorrect ? "text-(--color-success)" : "text-(--color-error)"}`}
              role="status"
            >
              {isCorrect ? "Richtig!" : "Leider falsch."}
            </p>
            <p className="text-xs text-(--color-text-secondary) mb-3">
              {question.explanation}
            </p>
            <button
              type="button"
              onClick={handleNext}
              className="px-3 py-1.5 text-xs font-medium bg-(--color-primary) text-(--color-on-primary) rounded-lg hover:bg-(--color-primary-hover) transition-colors"
            >
              {currentIndex < total - 1 ? "Nächste Frage" : "Ergebnis"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

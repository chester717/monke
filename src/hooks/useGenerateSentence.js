import { useCallback } from "react";

export const useGenerateSentence = () => {
  const nouns = [
    "dog",
    "car",
    "house",
    "tree",
    "computer",
    "book",
    "city",
    "cat",
    "river",
    "mountain",
  ];
  const verbs = [
    "run",
    "walk",
    "jump",
    "swim",
    "read",
    "write",
    "drive",
    "fly",
    "sing",
    "dance",
  ];
  const adjectives = [
    "quick",
    "lazy",
    "happy",
    "sad",
    "bright",
    "dark",
    "loud",
    "silent",
    "warm",
    "cold",
  ];
  const adverbs = [
    "quickly",
    "slowly",
    "happily",
    "sadly",
    "brightly",
    "darkly",
    "loudly",
    "silently",
    "warmly",
    "coldly",
  ];

  const randomizor = (array) => array[Math.floor(Math.random() * array.length)];

  const generateSentence = useCallback(() => {
    const templates = [
      `The ${randomizor(adjectives)} ${randomizor(nouns)} likes to ${randomizor(
        verbs
      )} ${randomizor(adverbs)}.`,
      `A ${randomizor(nouns)} can ${randomizor(verbs)} very ${randomizor(
        adverbs
      )} when it is ${randomizor(adjectives)}.`,
      `In the ${randomizor(adjectives)} ${randomizor(
        nouns
      )}, we often see people ${randomizor(verbs)}ing ${randomizor(adverbs)}.`,
      `Every ${randomizor(nouns)} has a unique way to ${randomizor(
        verbs
      )} that is both ${randomizor(adjectives)} and ${randomizor(adverbs)}.`,
      `When the ${randomizor(adjectives)} ${randomizor(
        nouns
      )} decides to ${randomizor(verbs)}, it does so very ${randomizor(
        adverbs
      )}.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  });
  return generateSentence;
};

export interface HighScore {
  score: number;
  wave: number;
  sword: string;
  date: string;
}

const KEY = "bladeclash_highscores_v1";

export function loadHighScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HighScore[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHighScore(entry: HighScore): HighScore[] {
  const list = loadHighScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, 8);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
  return trimmed;
}

export function isHighScore(score: number): boolean {
  const list = loadHighScores();
  if (score <= 0) return false;
  if (list.length < 8) return true;
  return score > list[list.length - 1].score;
}

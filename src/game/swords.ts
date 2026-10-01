export interface Sword {
  id: string;
  name: string;
  emoji: string;
  color: string;
  glow: string;
  blade: string;
  desc: string;
  effect: string;
  reach: number;      // attack hitbox length (px)
  damage: number;     // damage per hit
  swingSpeed: number; // ms per swing (lower = faster)
  knockback: number;  // horizontal knockback force
  moveSpeed: number;  // player move speed multiplier
  special: "none" | "fire" | "ice" | "lightning" | "vampire" | "heavy";
}

export const SWORDS: Sword[] = [
  {
    id: "katana",
    name: "Katana",
    emoji: "🗡️",
    color: "#e2e8f0",
    glow: "#a5b4fc",
    blade: "#dbeafe",
    desc: "Balanced & lightning fast swings.",
    effect: "Fast attacks, balanced stats",
    reach: 118,
    damage: 10,
    swingSpeed: 240,
    knockback: 7,
    moveSpeed: 1.1,
    special: "none",
  },
  {
    id: "flameblade",
    name: "Flameblade",
    emoji: "🔥",
    color: "#fb923c",
    glow: "#f97316",
    blade: "#fdba74",
    desc: "Ignites foes — burn damage over time.",
    effect: "Burn: deals damage over time",
    reach: 120,
    damage: 9,
    swingSpeed: 300,
    knockback: 6,
    moveSpeed: 1.0,
    special: "fire",
  },
  {
    id: "frostfang",
    name: "Frostfang",
    emoji: "❄️",
    color: "#7dd3fc",
    glow: "#38bdf8",
    blade: "#bae6fd",
    desc: "Chilling strikes slow the enemy.",
    effect: "Slow: freezes enemy movement",
    reach: 122,
    damage: 8,
    swingSpeed: 300,
    knockback: 6,
    moveSpeed: 1.05,
    special: "ice",
  },
  {
    id: "stormedge",
    name: "Stormedge",
    emoji: "⚡",
    color: "#fde047",
    glow: "#facc15",
    blade: "#fef08a",
    desc: "Crackling reach — chance to stun.",
    effect: "Stun chance + extra reach",
    reach: 150,
    damage: 11,
    swingSpeed: 330,
    knockback: 8,
    moveSpeed: 1.0,
    special: "lightning",
  },
  {
    id: "bloodthorn",
    name: "Bloodthorn",
    emoji: "🩸",
    color: "#f87171",
    glow: "#ef4444",
    blade: "#fca5a5",
    desc: "Lifesteal — heals you on hit.",
    effect: "Lifesteal: heal when you strike",
    reach: 116,
    damage: 9,
    swingSpeed: 320,
    knockback: 6,
    moveSpeed: 1.05,
    special: "vampire",
  },
  {
    id: "warhammer",
    name: "Titan Cleaver",
    emoji: "🪓",
    color: "#cbd5e1",
    glow: "#94a3b8",
    blade: "#e2e8f0",
    desc: "Massive damage & knockback. Slow.",
    effect: "Huge damage + knockback, slow swing",
    reach: 130,
    damage: 20,
    swingSpeed: 520,
    knockback: 16,
    moveSpeed: 0.85,
    special: "heavy",
  },
];

export const getSword = (id: string) => SWORDS.find((s) => s.id === id) ?? SWORDS[0];

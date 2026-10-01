import { Sword } from "../game/swords";

export function SwordCard({
  sword,
  selected,
  onClick,
  accent,
}: {
  sword: Sword;
  selected: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all duration-150 ${
        selected
          ? "scale-[1.03] shadow-lg"
          : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
      }`}
      style={
        selected
          ? {
              borderColor: sword.glow,
              background: `linear-gradient(135deg, ${sword.glow}22, ${sword.glow}08)`,
              boxShadow: `0 0 20px ${sword.glow}55`,
            }
          : undefined
      }
    >
      <div className="flex w-full items-center gap-2">
        <span
          className="text-2xl leading-none"
          style={{ filter: `drop-shadow(0 0 6px ${sword.glow})` }}
        >
          {sword.emoji}
        </span>
        <span className="font-black tracking-wide text-white" style={{ color: selected ? sword.glow : "#fff" }}>
          {sword.name}
        </span>
      </div>
      <p className="text-[11px] leading-tight text-slate-300">{sword.desc}</p>
      <div className="mt-1 grid w-full grid-cols-3 gap-1 text-[9px] font-bold uppercase text-slate-400">
        <Stat label="DMG" value={sword.damage} max={20} color={accent} />
        <Stat label="SPD" value={Math.round((600 - sword.swingSpeed) / 40)} max={12} color={accent} />
        <Stat label="KB" value={sword.knockback} max={16} color={accent} />
      </div>
    </button>
  );
}

function Stat({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-0.5">{label}</div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

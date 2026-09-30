import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CHANGELOG, formatUpdateDate } from "@/lib/game/changelog";
import { requirePlayer } from "@/lib/game/queries";
import { MarkSeen } from "./MarkSeen";

export const metadata: Metadata = { title: "Bản cập nhật" };

export default async function UpdatesPage() {
  await requirePlayer();

  return (
    <main className="app">
      <div className="screen screen--with-nav">
        <ScreenHeader title="Bản cập nhật" />
        <MarkSeen />
        <ol className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {CHANGELOG.map((entry, i) => (
            <li key={entry.date} className="card stack" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className="badge">{formatUpdateDate(entry.date)}</span>
                {i === 0 && (
                  <span className="badge" style={{ background: "var(--strawberry-strong)", color: "#fff" }}>
                    Mới nhất
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: 18, margin: 0 }}>{entry.title}</h2>
              <ul className="small" style={{ margin: 0, paddingLeft: 18, fontWeight: 700, lineHeight: 1.6 }}>
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
      <BottomNav />
    </main>
  );
}

import Link from "next/link";
import { formatNumber } from "@/lib/game/format";
import { CoinIcon, GemIcon, IconBack } from "./icons";

export function ScreenHeader({
  title,
  back = "/shop",
  coins,
  gems,
  right,
}: {
  title: string;
  back?: string | null;
  coins?: number;
  gems?: number;
  right?: React.ReactNode;
}) {
  return (
    <header className="header">
      {back && (
        <Link href={back} className="icon-btn" aria-label="Quay lại">
          <IconBack size={20} />
        </Link>
      )}
      <h1>{title}</h1>
      {coins !== undefined && (
        <span className="pill" aria-label={`${coins} xu`}>
          <CoinIcon />
          {formatNumber(coins)}
        </span>
      )}
      {gems !== undefined && (
        <span className="pill" style={{ paddingLeft: 8 }} aria-label={`${gems} gem`}>
          <GemIcon />
          {formatNumber(gems)}
        </span>
      )}
      {right}
    </header>
  );
}

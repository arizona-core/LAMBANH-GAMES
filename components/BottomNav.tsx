"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBag, IconCart, IconHome, IconKitchen, IconTrophy } from "./icons";

const ITEMS = [
  { href: "/shop", label: "Tiệm", Icon: IconHome },
  { href: "/kitchen", label: "Bếp", Icon: IconKitchen },
  { href: "/market", label: "Chợ", Icon: IconCart },
  { href: "/leaderboard", label: "BXH", Icon: IconTrophy },
  { href: "/store", label: "Cửa hàng", Icon: IconBag },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Điều hướng chính">
      {ITEMS.map(({ href, label, Icon }) => (
        <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  { href: "/", label: "홈" },
  { href: "/chart", label: "글자표" },
  { href: "/practice", label: "연습" },
  { href: "/records", label: "기록" },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) {
    return false;
  }
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="주요 탐색" className="app-nav">
      <ul>
        {destinations.map((destination) => (
          <li key={destination.href}>
            <Link
              aria-current={isActive(pathname, destination.href) ? "page" : undefined}
              href={destination.href}
            >
              {destination.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

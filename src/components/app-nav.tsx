import Link from "next/link";

const destinations = [
  { href: "/", label: "홈" },
  { href: "/chart", label: "글자표" },
  { href: "/practice", label: "연습" },
  { href: "/records", label: "기록" },
];

export function AppNav() {
  return (
    <nav aria-label="주요 탐색" className="app-nav">
      <ul>
        {destinations.map((destination) => (
          <li key={destination.href}>
            <Link href={destination.href}>{destination.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

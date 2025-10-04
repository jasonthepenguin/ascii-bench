import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold">
          ASCII Bench
        </Link>
        <div className="flex gap-8">
          <Link href="/" className="hover:text-gray-600 transition-colors">
            Vote
          </Link>
          <Link href="/leaderboard" className="hover:text-gray-600 transition-colors">
            Leaderboard
          </Link>
          <Link href="/about" className="hover:text-gray-600 transition-colors">
            About
          </Link>
        </div>
      </div>
    </nav>
  );
}

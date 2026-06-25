import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/about", label: "À propos" },
  { href: "/why", label: "Pourquoi RapportAI" },
  { href: "/story", label: "Notre histoire" },
  { href: "/pricing", label: "Tarifs" },
];

export default function PublicNavbar() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  function handleLogo(e: React.MouseEvent) {
    if (location === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">

        {/* Left — Logo */}
        <Link href="/" onClick={handleLogo}>
          <div className="flex items-center gap-2 cursor-pointer">
            <img src="/logo.png" alt="RapportAI" className="w-8 h-8" />
            <span className="font-bold text-xl tracking-tight text-gray-900">RapportAI</span>
          </div>
        </Link>

        {/* Center — Nav links (desktop) */}
        <div className="hidden md:flex items-center justify-center gap-6 flex-1">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              <span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors cursor-pointer">{l.label}</span>
            </Link>
          ))}
        </div>

        {/* Right — Auth + hamburger */}
        <div className="flex items-center justify-end gap-2 flex-shrink-0">
          <Link href="/sign-in">
            <Button variant="ghost" className="hidden sm:inline-flex text-gray-700 hover:text-purple-600">
              Se connecter
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-4 sm:px-5 shadow-sm whitespace-nowrap">
              <span className="sm:hidden">Commencer</span>
              <span className="hidden sm:inline">Commencer gratuitement</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <nav className="container mx-auto px-4 py-2 flex flex-col">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                <span
                  onClick={() => setOpen(false)}
                  className="block py-3 text-sm font-medium text-gray-700 hover:text-purple-600 cursor-pointer"
                >
                  {l.label}
                </span>
              </Link>
            ))}
            <Link href="/sign-in">
              <span
                onClick={() => setOpen(false)}
                className="block py-3 mt-1 border-t border-gray-100 text-sm font-semibold text-purple-600 cursor-pointer"
              >
                Se connecter
              </span>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

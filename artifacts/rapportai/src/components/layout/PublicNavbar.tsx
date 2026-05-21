import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function PublicNavbar() {
  const [location] = useLocation();

  function handleLogo(e: React.MouseEvent) {
    if (location === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="container mx-auto px-4 h-16 grid grid-cols-3 items-center">

        {/* Left — Logo */}
        <Link href="/" onClick={handleLogo}>
          <div className="flex items-center gap-2 cursor-pointer">
            <img src="/logo.svg" alt="RapportAI" className="w-8 h-8" />
            <span className="font-bold text-xl tracking-tight text-gray-900">RapportAI</span>
          </div>
        </Link>

        {/* Center — Nav links */}
        <div className="hidden md:flex items-center justify-center gap-6">
          <Link href="/about">
            <span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors cursor-pointer">À propos</span>
          </Link>
          <Link href="/why">
            <span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors cursor-pointer">Pourquoi RapportAI</span>
          </Link>
          <Link href="/story">
            <span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors cursor-pointer">Notre histoire</span>
          </Link>
        </div>

        {/* Right — Auth */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" className="hidden sm:inline-flex text-gray-700 hover:text-purple-600">
              Se connecter
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-5 shadow-sm">
              Commencer gratuitement <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

      </div>
    </header>
  );
}

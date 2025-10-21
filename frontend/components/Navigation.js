import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { href: '/', label: '🏠 Главная' },
    { href: '/manage-users', label: '👥 Пользователи' },
    { href: '/manage-roles', label: '🎭 Роли' },
    { href: '/game-control', label: '🎮 Управление игрой' },
  ];

  return (
    <nav className="bg-darkAlt border-b border-purple-500/20 sticky top-0 z-50">
      <div className="container-custom flex justify-between items-center py-4">
        <Link href="/" className="gradient-text text-2xl font-bold">
          🎲 MAFIA TT
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-purple-400 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-darkAlt border-t border-purple-500/20 p-4">
          <div className="flex flex-col gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-purple-400 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
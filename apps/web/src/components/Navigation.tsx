'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Home, List, Activity, LogOut } from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();

  // Do not render navigation on login page
  if (pathname === '/login') return null;

  const links = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/reports', label: 'Reports', icon: List },
    { href: '/continuity', label: 'Continuity', icon: Activity },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
      <div className="text-xl font-bold mb-8 px-4 py-2">NER Sahayak</div>
      <nav className="flex-1 space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href; // Bug Fix #4: Use usePathname for active state
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <Icon size={20} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      
      <button
        onClick={() => signOut(auth)} // Bug Fix #3: Correct usage of signOut
        className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors mt-auto w-full text-left"
      >
        <LogOut size={20} />
        Sign Out
      </button>
    </aside>
  );
}

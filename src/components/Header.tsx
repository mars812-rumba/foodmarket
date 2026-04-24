import { Menu, Phone } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";

const menuItems = [
  { label: "Как заказать?", href: "#order" },
  { label: "Доставка", href: "#delivery" },
  { label: "О компании", href: "#about" },
  { label: "Контакты", href: "#contacts" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/95 backdrop-blur-xl shadow-sm">
        <div className="safe-padding-x mx-auto flex h-16 sm:h-20 max-w-[1440px] items-center justify-between">
          
          {/* Логотип и Слоган */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl sm:text-3xl font-[1000] tracking-tighter text-slate-900">LOFT</span>
              <span className="text-2xl sm:text-3xl font-[1000] tracking-tighter text-orange-600">FIRE</span>
            </div>
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-400 leading-tight">
              характер в деталях
            </span>
          </div>

          {/* Меню - десктоп */}
          <nav className="hidden md:flex items-center gap-4 lg:gap-6">
            {menuItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-semibold text-slate-600 hover:text-orange-600 transition-colors px-2 py-1"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Кнопка звонка + меню */}
          <div className="flex items-center gap-2">
            <a
              href="tel:+79001234567"
              className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg bg-orange-600 text-white shadow-sm transition-all hover:bg-orange-500 active:scale-95"
              aria-label="Позвонить"
            >
              <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shadow-sm transition-all hover:bg-slate-200 active:scale-95 md:hidden"
              aria-label="Открыть меню"
            >
              <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Мобильное меню */}
      <div className={cn(
        "fixed inset-x-0 top-16 sm:top-20 z-40 bg-white border-b border-slate-200 shadow-lg transition-all duration-300 md:hidden",
        mobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
      )}>
        <nav className="flex flex-col py-2">
          {menuItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-orange-600 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Overlay для мобильного меню */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
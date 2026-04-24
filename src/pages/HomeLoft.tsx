import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { categories, categoryImages } from "../data/LOFTcategories";
import { Button } from "../components/ui/button";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "../lib/utils";

export function Home() {
  const [selected, setSelected] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Реф для кнопки, чтобы к ней скроллить
  const catalogButtonRef = useRef<HTMLDivElement>(null);

  // Скролл при выборе категории
  useEffect(() => {
    if (selected && catalogButtonRef.current) {
      setTimeout(() => {
        catalogButtonRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }, 100);
    }
  }, [selected]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <Header />
      
      <main className="safe-padding-x mx-auto max-w-[1440px] pt-8 sm:pt-12 pb-24">
        {/* Заголовок */}
        <div className="mb-8 sm:mb-12 text-center">
          <h1 className="text-2xl sm:text-3xl font-[1000] tracking-tighter text-slate-900 mb-2">
            Выберите категорию
          </h1>
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-400">
            ЛОФТ на заказ и в наличии
          </p>
        </div>

        {/* Сетка категорий */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:gap-8">
          {categories.map((cat) => {
            const isSelected = selected === cat.id;
            const imageUrl = categoryImages[cat.id];
            
            return (
              <button
                key={cat.id}
                onClick={() => setSelected(cat.id)}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-lg border-2 transition-all duration-300 transform",
                  isSelected
                    ? "border-orange-600 bg-white shadow-2xl scale-[1.02] z-20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg"
                )}
              >
                <div className="relative aspect-square w-full overflow-hidden">
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={cat.name}
                      className={cn(
                        "h-full w-full object-cover transition-transform duration-700",
                        isSelected ? "scale-110" : "scale-100 group-hover:scale-105"
                      )}
                    />
                  )}

                  {/* Градиент для лучшей читаемости текста */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                  {/* Плашка с названием */}
                  <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3">
                    <div className={cn(
                      "flex items-center gap-2 sm:gap-3 rounded-md py-1.5 sm:py-2 px-3 sm:px-4 shadow-lg transition-all duration-300",
                      isSelected
                        ? "bg-orange-600 text-white"
                        : "bg-white/95 text-slate-900 backdrop-blur-sm"
                    )}>
                      <cat.icon className={cn(
                        "h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0",
                        isSelected ? "text-white" : "text-slate-600"
                      )} />
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider truncate">
                        {cat.name}
                      </span>
                    </div>
                  </div>

                  {/* Чекмарк */}
                  {isSelected && (
                    <div className="absolute right-2 top-2 sm:right-3 sm:top-3 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg ring-2 ring-white animate-in zoom-in-50 duration-200">
                      <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3]" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Кнопка каталога */}
        <div
          ref={catalogButtonRef}
          className="mt-12 sm:mt-16 flex justify-center"
        >
          <Button
            disabled={!selected}
            onClick={() => navigate(`/catalog?category=${selected}`)}
            className={cn(
              "h-14 sm:h-16 w-full max-w-sm sm:max-w-md rounded-lg text-base sm:text-lg font-black uppercase tracking-wider sm:tracking-widest transition-all duration-300 shadow-lg",
              selected
                ? "bg-orange-600 text-white hover:bg-orange-500 active:scale-[0.98] shadow-orange-600/20"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
          >
            <span className="flex items-center justify-center gap-2 sm:gap-3">
              {selected ? "ОТКРЫТЬ КАТАЛОГ" : "ВЫБЕРИТЕ КАТЕГОРИЮ"}
              <ArrowRight className={cn(
                "h-5 w-5 sm:h-6 sm:w-6 transition-transform",
                selected && "animate-pulse translate-x-1"
              )} />
            </span>
          </Button>
        </div>

        {/* Дополнительная информация */}
        {selected && (
          <div className="mt-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-xs sm:text-sm text-slate-500">
              {categories.find(c => c.id === selected)?.name} •
              <span className="font-semibold ml-1">
                {categories.find(c => c.id === selected)?.id === 'grills' ? '15 моделей' :
                 categories.find(c => c.id === selected)?.id === 'furniture' ? '23 модели' :
                 categories.find(c => c.id === selected)?.id === 'shelving' ? '18 моделей' :
                 categories.find(c => c.id === selected)?.id === 'stoves' ? '12 моделей' :
                 categories.find(c => c.id === selected)?.id === 'tables' ? '20 моделей' :
                 categories.find(c => c.id === selected)?.id === 'cages' ? '8 моделей' : ''}
              </span>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
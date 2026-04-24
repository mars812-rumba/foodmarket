import { Link } from "react-router-dom";
import { Header } from "../components/Header";

export function meta() {
  return [
    { title: "Страница не найдена — LoftFire" },
    { name: "description", content: "Страница не найдена" },
  ];
}

export function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-7xl font-bold text-foreground">404</h1>
          <h2 className="mt-4 text-xl font-semibold text-foreground">Страница не найдена</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Страница, которую вы ищете, не существует или была перемещена.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              На главную
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

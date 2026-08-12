import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DailyRecord from "./pages/DailyRecord";
import MonthlyReport from "./pages/MonthlyReport";
import NotFound from "./pages/NotFound";
import { Route, Router, Switch } from "wouter";

function AppRouter() {
  const base = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <Router base={base}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/daily-record" component={DailyRecord} />
        <Route path="/monthly-report" component={MonthlyReport} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

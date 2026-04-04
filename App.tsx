import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import SetupProfile from "./pages/SetupProfile";
import ClienteDashboard from "./pages/ClienteDashboard";
import MotoristaDashboard from "./pages/MotoristaDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";
import { useLocation } from "wouter";
import { useEffect } from "react";

function ProtectedRoute({
  component: Component,
  requiredType,
  requiredRole,
}: {
  component: React.ComponentType;
  requiredType?: "CLIENT" | "DRIVER";
  requiredRole?: "admin";
}) {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (requiredRole && user?.role !== requiredRole) {
      navigate("/");
      return;
    }
    if (requiredType && user?.userType !== requiredType) {
      navigate("/");
      return;
    }
  }, [loading, isAuthenticated, user, navigate, requiredType, requiredRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/setup" component={() => <ProtectedRoute component={SetupProfile} />} />
      <Route path="/cliente" component={() => <ProtectedRoute component={ClienteDashboard} requiredType="CLIENT" />} />
      <Route path="/motorista" component={() => <ProtectedRoute component={MotoristaDashboard} requiredType="DRIVER" />} />
      <Route path="/admin" component={() => <ProtectedRoute component={AdminDashboard} requiredRole="admin" />} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

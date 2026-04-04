import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { ArrowRight, CheckCircle, Package, Shield, Truck } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading || !isAuthenticated || !user) return;

    if (user.role === "admin") {
      navigate("/admin");
    } else if (!user.userType || user.userType === "CLIENT") {
      if (!user.cidade) {
        navigate("/setup");
      } else {
        navigate("/cliente");
      }
    } else if (user.userType === "DRIVER") {
      if (!user.cidade) {
        navigate("/setup");
      } else {
        navigate("/motorista");
      }
    }
  }, [user, loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Truck className="w-6 h-6 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center">
              <Truck className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Mobi Green</span>
          </div>
          <Button
            onClick={() => (window.location.href = getLoginUrl())}
            variant="secondary"
            size="sm"
            className="bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80"
          >
            Entrar
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-sidebar text-sidebar-foreground pb-20 pt-16">
        <div className="container text-center">
          <div className="inline-flex items-center gap-2 bg-sidebar-accent/50 rounded-full px-4 py-1.5 text-sm mb-6">
            <CheckCircle className="w-4 h-4 text-green-400" />
            Plataforma de fretes sustentável
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-sidebar-foreground">
            Conectamos clientes<br />e motoristas
          </h1>
          <p className="text-sidebar-foreground/70 text-lg max-w-xl mx-auto mb-8">
            Crie fretes, encontre motoristas próximos e pague com segurança via PIX. 
            Simples, rápido e eficiente.
          </p>
          <Button
            size="lg"
            onClick={() => (window.location.href = getLoginUrl())}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
          >
            Começar agora <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Diagonal divider */}
      <div className="h-12 bg-sidebar" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 0)" }} />

      {/* Features */}
      <section className="container py-16">
        <h2 className="text-2xl font-bold text-center text-foreground mb-10">
          Como funciona
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="text-center p-6 rounded-xl bg-card border border-border">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">1. Crie seu frete</h3>
            <p className="text-sm text-muted-foreground">
              Informe origem, destino, valor e cidade. Seu frete fica disponível para motoristas.
            </p>
          </div>
          <div className="text-center p-6 rounded-xl bg-card border border-border">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Truck className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">2. Motorista aceita</h3>
            <p className="text-sm text-muted-foreground">
              Motoristas da sua cidade visualizam e aceitam o frete disponível.
            </p>
          </div>
          <div className="text-center p-6 rounded-xl bg-card border border-border">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">3. Pague com PIX</h3>
            <p className="text-sm text-muted-foreground">
              Após a entrega, pague via PIX. A plataforma retém apenas 5% de comissão.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary/5 border-t border-border py-12">
        <div className="container text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Pronto para começar?
          </h2>
          <p className="text-muted-foreground mb-6">
            Crie sua conta gratuitamente e comece a usar agora.
          </p>
          <Button
            size="lg"
            onClick={() => (window.location.href = getLoginUrl())}
          >
            Criar conta grátis <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      <footer className="bg-sidebar text-sidebar-foreground/60 py-6 text-center text-sm">
        © {new Date().getFullYear()} Mobi Green — Plataforma de Fretes
      </footer>
    </div>
  );
}

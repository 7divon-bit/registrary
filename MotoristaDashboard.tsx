import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FreteCard } from "@/components/FreteCard";
import { trpc } from "@/lib/trpc";
import { LogOut, MapPin, RefreshCw, Search, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function MotoristaDashboard() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();

  const [cidade, setCidade] = useState(user?.cidade ?? "");
  const [cidadeInput, setCidadeInput] = useState(user?.cidade ?? "");

  const {
    data: openFretes,
    isLoading: loadingOpen,
    refetch: refetchOpen,
  } = trpc.fretes.listOpen.useQuery(
    { cidade },
    { enabled: cidade.length > 1 }
  );

  const { data: myRides, isLoading: loadingRides } = trpc.fretes.myRides.useQuery();

  const handleSearch = () => {
    if (!cidadeInput.trim()) return toast.error("Informe uma cidade.");
    setCidade(cidadeInput.trim());
  };

  const inProgress = myRides?.filter((f) => f.status === "ASSIGNED") ?? [];
  const delivered = myRides?.filter((f) => f.status === "DELIVERED") ?? [];

  const totalEarned = delivered.reduce((sum, f) => {
    const val = parseFloat(String(f.valor));
    return sum + (val - val * 0.05);
  }, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-sidebar text-sidebar-foreground shadow-md">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center">
              <Truck className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Mobi Green</span>
            <Badge variant="secondary" className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
              Motorista
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-sidebar-foreground/80 hidden sm:block">
              {user?.name ?? user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{inProgress.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Em andamento</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-green-600">{delivered.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Entregues</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-primary">
                R$ {totalEarned.toFixed(0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Total ganho</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="open">
          <TabsList className="w-full">
            <TabsTrigger value="open" className="flex-1">
              Fretes Disponíveis
              {openFretes && openFretes.length > 0 && (
                <Badge className="ml-2 text-xs" variant="secondary">
                  {openFretes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="my" className="flex-1">
              Meus Fretes
              {inProgress.length > 0 && (
                <Badge className="ml-2 text-xs bg-yellow-100 text-yellow-700">
                  {inProgress.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Fretes disponíveis */}
          <TabsContent value="open" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cidade..."
                  value={cidadeInput}
                  onChange={(e) => setCidadeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch} size="icon" variant="outline">
                <Search className="w-4 h-4" />
              </Button>
              <Button onClick={() => refetchOpen()} size="icon" variant="outline">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {!cidade ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <MapPin className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Informe uma cidade para ver os fretes disponíveis</p>
                </CardContent>
              </Card>
            ) : loadingOpen ? (
              <div className="text-center py-12 text-muted-foreground">Buscando fretes...</div>
            ) : !openFretes || openFretes.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Truck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">Nenhum frete disponível em {cidade}</p>
                  <p className="text-sm text-muted-foreground mt-1">Tente outra cidade ou aguarde novos fretes</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {openFretes.map((frete) => (
                  <FreteCard
                    key={frete.id}
                    frete={frete}
                    role="DRIVER"
                    onAccepted={() => utils.fretes.listOpen.invalidate()}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Meus fretes */}
          <TabsContent value="my" className="space-y-4 mt-4">
            {loadingRides ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : !myRides || myRides.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Truck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Você ainda não aceitou nenhum frete</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myRides.map((frete) => (
                  <FreteCard key={frete.id} frete={frete} role="DRIVER" />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

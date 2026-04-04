import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  DollarSign,
  LogOut,
  Package,
  RefreshCw,
  Shield,
  Truck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Disponível",
  ASSIGNED: "Em andamento",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

const STATUS_CLASSES: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-yellow-100 text-yellow-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const PAYMENT_CLASSES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();

  const { data: stats, isLoading: loadingStats } = trpc.admin.stats.useQuery();
  const { data: fretes, isLoading: loadingFretes } = trpc.admin.listFretes.useQuery();
  const { data: users, isLoading: loadingUsers } = trpc.admin.listUsers.useQuery();
  const { data: payments, isLoading: loadingPayments } = trpc.admin.listPayments.useQuery();

  const handleRefresh = () => {
    utils.admin.stats.invalidate();
    utils.admin.listFretes.invalidate();
    utils.admin.listUsers.invalidate();
    utils.admin.listPayments.invalidate();
    toast.success("Dados atualizados!");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-sidebar text-sidebar-foreground shadow-md">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Mobi Green</span>
            <Badge variant="secondary" className="bg-red-900/60 text-red-100 text-xs">
              Admin
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleRefresh} className="text-sidebar-foreground hover:bg-sidebar-accent">
              <RefreshCw className="w-4 h-4" />
            </Button>
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
        {loadingStats ? (
          <div className="text-center py-6 text-muted-foreground">Carregando estatísticas...</div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Total Fretes</span>
                </div>
                <div className="text-2xl font-bold">{stats.totalFretes}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stats.openFretes} abertos · {stats.deliveredFretes} entregues
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Usuários</span>
                </div>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stats.clients} clientes · {stats.drivers} motoristas
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Motoristas</span>
                </div>
                <div className="text-2xl font-bold">{stats.drivers}</div>
                <div className="text-xs text-muted-foreground mt-1">ativos na plataforma</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Receita (5%)</span>
                </div>
                <div className="text-2xl font-bold text-green-700">
                  R$ {stats.totalRevenue.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">comissões acumuladas</div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <Tabs defaultValue="fretes">
          <TabsList>
            <TabsTrigger value="fretes">Fretes</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          </TabsList>

          {/* Fretes */}
          <TabsContent value="fretes" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Todos os Fretes</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingFretes ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead>Cidade</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Motorista</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fretes?.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell className="font-mono text-xs">#{f.id}</TableCell>
                            <TableCell className="max-w-[120px] truncate text-sm">{f.origem}</TableCell>
                            <TableCell className="max-w-[120px] truncate text-sm">{f.destino}</TableCell>
                            <TableCell className="text-sm">{f.cidade}</TableCell>
                            <TableCell className="font-semibold text-sm">
                              R$ {parseFloat(String(f.valor)).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[f.status]}`}
                              >
                                {STATUS_LABELS[f.status]}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">#{f.clientId}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {f.driverId ? `#${f.driverId}` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {(!fretes || fretes.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">Nenhum frete encontrado</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Usuários */}
          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Todos os Usuários</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Perfil</TableHead>
                          <TableHead>Cidade</TableHead>
                          <TableHead>Função</TableHead>
                          <TableHead>Cadastro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users?.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-mono text-xs">#{u.id}</TableCell>
                            <TableCell className="text-sm font-medium">{u.name ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                            <TableCell>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  u.userType === "DRIVER"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-purple-100 text-purple-700"
                                }`}
                              >
                                {u.userType === "DRIVER" ? "Motorista" : "Cliente"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">{u.cidade ?? "—"}</TableCell>
                            <TableCell>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  u.role === "admin"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {u.role}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {(!users || users.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pagamentos */}
          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Todos os Pagamentos</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPayments ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Frete</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Comissão (5%)</TableHead>
                          <TableHead>Motorista</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments?.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">#{p.id}</TableCell>
                            <TableCell className="text-sm">#{p.freteId}</TableCell>
                            <TableCell className="font-semibold text-sm">
                              R$ {parseFloat(String(p.total)).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-sm text-green-700 font-medium">
                              R$ {parseFloat(String(p.commission)).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-sm">
                              R$ {parseFloat(String(p.driverAmount)).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_CLASSES[p.status]}`}
                              >
                                {p.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {(!payments || payments.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">Nenhum pagamento encontrado</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

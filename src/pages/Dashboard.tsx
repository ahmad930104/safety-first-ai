import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Shield, Users, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function Dashboard() {
  const { data: violations = [] } = useQuery({
    queryKey: ["violations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("violations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const todayViolations = violations.filter(
    (v) => new Date(v.created_at).toDateString() === new Date().toDateString()
  );

  // Last 7 days chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayStart = startOfDay(date);
    const count = violations.filter(
      (v) => startOfDay(new Date(v.created_at)).getTime() === dayStart.getTime()
    ).length;
    return { day: format(date, "EEE"), count };
  });

  // Missing gear breakdown
  const gearCounts: Record<string, number> = {};
  violations.forEach((v) => {
    (v.missing_gear as string[])?.forEach((g: string) => {
      gearCounts[g] = (gearCounts[g] || 0) + 1;
    });
  });
  const gearData = Object.entries(gearCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = [
    "hsl(0, 72%, 51%)",
    "hsl(38, 92%, 50%)",
    "hsl(220, 60%, 50%)",
    "hsl(142, 71%, 45%)",
    "hsl(280, 60%, 50%)",
  ];

  const severityCounts = violations.reduce(
    (acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Safety compliance overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Violations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{violations.length}</div>
            <p className="text-xs text-muted-foreground">All time records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayViolations.length}</div>
            <p className="text-xs text-muted-foreground">Violations today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-danger">{severityCounts["critical"] || 0}</div>
            <p className="text-xs text-muted-foreground">Critical violations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{severityCounts["high"] || 0}</div>
            <p className="text-xs text-muted-foreground">High severity</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Violations - Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(0, 72%, 51%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Missing Gear Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {gearData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={gearData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {gearData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Violations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Violations</CardTitle>
        </CardHeader>
        <CardContent>
          {violations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No violations recorded yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {violations.slice(0, 6).map((v) => (
                <div key={v.id} className="group overflow-hidden rounded-lg border">
                  <div className="aspect-video overflow-hidden bg-muted">
                    <img
                      src={v.photo_url}
                      alt="Violation"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium">{v.employee_description || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(v.created_at), "MMM dd, yyyy HH:mm")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(v.missing_gear as string[])?.map((g: string) => (
                        <Badge key={g} variant="destructive" className="text-xs">
                          {g}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

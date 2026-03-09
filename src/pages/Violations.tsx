import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Violations() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const { data: violations = [], refetch } = useQuery({
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

  const filtered = violations.filter((v) => {
    const matchesSearch =
      !search ||
      v.employee_description?.toLowerCase().includes(search.toLowerCase()) ||
      (v.missing_gear as string[])?.some((g: string) => g.toLowerCase().includes(search.toLowerCase()));
    const matchesSeverity = severityFilter === "all" || v.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("violations").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Violation deleted");
      refetch();
    }
  };

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "destructive" as const;
      case "high": return "destructive" as const;
      case "medium": return "secondary" as const;
      default: return "outline" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Violations Log</h1>
          <p className="text-muted-foreground">{filtered.length} records found</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by description or gear..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Missing Gear</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No violations found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <img
                        src={v.photo_url}
                        alt="Violation"
                        className="h-12 w-16 cursor-pointer rounded object-cover transition-opacity hover:opacity-80"
                        onClick={() => setSelectedPhoto(v.photo_url)}
                        loading="lazy"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {v.employee_description || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(v.missing_gear as string[])?.map((g: string) => (
                          <Badge key={g} variant="destructive" className="text-xs">
                            {g}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityColor(v.severity)} className="capitalize">
                        {v.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(v.created_at), "MMM dd, yyyy")}
                      <br />
                      {format(new Date(v.created_at), "HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(v.id)}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Photo Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Violation Photo</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <img src={selectedPhoto} alt="Violation detail" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

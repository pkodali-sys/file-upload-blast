import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DownloadIcon, PlusIcon, SearchIcon, FilterIcon } from "lucide-react";
import FilesTable from "@/components/files-table";

export default function Files() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const limit = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "/api/files",
      {
        page,
        limit,
        search: search || undefined,
        category: category === "all" ? undefined : category,
      },
    ],
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-2" data-testid="text-page-title">
              Uploaded Files
            </h1>
            <p className="text-muted-foreground">
              Manage your uploaded documents in this page.
            </p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex flex-1 space-x-4">
            <div className="relative flex-1 max-w-md">
              <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <FilesTable
          data={data as any}
          isLoading={isLoading}
          error={error}
          page={page}
          onPageChange={setPage}
          search={search}
          category={category}
        />
      </div>
    </main>
  );
}

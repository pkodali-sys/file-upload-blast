import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DownloadIcon, PlusIcon, SearchIcon, FilterIcon } from "lucide-react";
import FilesTable from "@/components/files-table";
import { File, PaginatedResult } from "shared/schema";

export default function Files() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const limit = 10;

  // Keep previous data while fetching next page
  const [previousData, setPreviousData] = useState<PaginatedResult<File> | null>(null);

  const { data, isLoading, error } = useQuery<PaginatedResult<File>, Error>({
    queryKey: ["files", page, search ?? "", category],
    queryFn: async (): Promise<PaginatedResult<File>> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search ? { search } : {}),
        ...(category !== "all" ? { category } : {}),
      });

      const res = await fetch(`/api/files?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    },
    onSuccess: (newData) => {
      setPreviousData(newData);
    },
  });

  const displayData = data ?? previousData;

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
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset page when searching
                }}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>
          <div>
            <Select
              value={category}
              onValueChange={(val) => {
                setCategory(val);
                setPage(1); // Reset page when changing category
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="documents">Documents</SelectItem>
                <SelectItem value="images">Images</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Files Table */}
        <FilesTable
          data={displayData as any}
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

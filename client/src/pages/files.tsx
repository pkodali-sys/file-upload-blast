import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DownloadIcon, SearchIcon } from "lucide-react";
import FilesTable from "@/components/files-table";
import * as XLSX from "xlsx";

import { File, PaginatedResult } from "shared/schema";

export default function Files() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const limit = 10;

  // Keep previous data while fetching next page
  const [previousData, setPreviousData] =
    useState<PaginatedResult<File> | null>(null);

  // Replace with actual user context or backend call
  const currentUser = { username: "TBS_Admin" };

  const { data, isLoading, error } = useQuery<PaginatedResult<File>, Error>({
    queryKey: ["files", page, search ?? "", category],
    queryFn: async (): Promise<PaginatedResult<File>> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search ? { search } : {}),
        ...(category !== "all" ? { category } : {}),
      });

      const res = await fetch(`/api/files?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    },
    onSuccess: (newData) => {
      setPreviousData(newData);
    },
  });

  const displayData = data ?? previousData;

  const exportAllToExcel = async () => {
    try {
      let allFiles: File[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: "50", // fetch larger chunks
          ...(search ? { search } : {}),
          ...(category !== "all" ? { category } : {}),
        });

        const res = await fetch(`/api/files?${params.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch files");

        const result: PaginatedResult<File> = await res.json();
        allFiles = allFiles.concat(result.files);
        totalPages = result.totalPages;
        page++;
      } while (page <= totalPages);

      if (!allFiles.length) {
        alert("No files to export.");
        return;
      }

      const sheetData = allFiles.map((f) => ({
        "Destination File Name": f.name,
        "Destination File Url": `${window.location.origin}/api/files/${f.id}/view`,
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, "Files");
      XLSX.writeFile(wb, "AllFiles.xlsx");

      alert(`Exported ${allFiles.length} files!`);
    } catch (err) {
      console.error(err);
      alert("Error exporting files. See console for details.");
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Uploaded Files
            </h1>
            <p className="text-muted-foreground">
              Manage your uploaded documents in this page.
            </p>
          </div>

          {/* Show Export button only for TBS_Admin */}
          {currentUser.username === "TBS_Admin" && (
            <Button
              onClick={exportAllToExcel}
              className="flex items-center space-x-2"
              disabled={!displayData?.files?.length}
            >
              <DownloadIcon className="w-4 h-4" />
              <span>Export All</span>
            </Button>
          )}
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
              />
            </div>
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

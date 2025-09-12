import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  FileTextIcon, 
  ImageIcon, 
  EditIcon, 
  TrashIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  LoaderIcon,
  LinkIcon,
  FileIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

interface File {
  id: string;
  name: string;
  originalName: string;
  size: number;
  category: string;
  amount?: string;
  uploadedBy: string;
  uploadedAt: string;
  mimeType: string;
}

interface FilesTableProps {
  data: {
    files: File[];
    total: number;
    page: number;
    totalPages: number;
  } | undefined;
  isLoading: boolean;
  error: any;
  page: number;
  onPageChange: (page: number) => void;
  search: string;
  category: string;
}

// const getFileIcon = (mimeType: string) => {
//   if (mimeType.startsWith('image/')) {
//     return <ImageIcon className="w-4 h-4 text-chart-2" />;
//   } if(mimeType === "application/msword" || mimeType === "application/vnd.openxmlformats-oficedocument.wordprocessingml.document"){
//     return <FileIcon className="w-4 h-4 text-chart-1" />
//   }
//   return <FileTextIcon className="w-4 h-4 text-destructive" />;
// };

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) {
    return <ImageIcon className="w-4 h-4 text-chart-2" />;
  }
  if (mimeType === "application/msword" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return <FileIcon className="w-4 h-4 text-chart-1" />;
  }
  if (mimeType === "application/pdf") {
    return <FileTextIcon className="w-4 h-4 text-destructive" />;
  }
  return <FileIcon className="w-4 h-4 text-gray-500" />; 
};

const getFileIconBg = (mimeType: string) => {
  if (mimeType.startsWith('image/')) {
    return "bg-chart-2/10";
  }
  if (mimeType === "application/pdf") {
    return "bg-destructive/10";
  }
  if (mimeType === "application/msword" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "bg-chart-1/10";
  }
  return "bg-chart/10";
}

// const getFileIconBg = (mimeType: string) => {
//     if (mimeType.startsWith('image/')) {
//       return "bg-chart-2/10";
//     }
//     if(mimeType === "application/pdf") {
//       return "bg-destructive/10";
//     }
//     if(mimeType === "application/msword" || mimeType === "application/vnd.openxmlformats-oficedocument.wordprocessingml.document") {
//       return "bg-chart-1/10";
//     }
//   return "bg-chart/10";
// };

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function FilesTable({ 
  data, 
  isLoading, 
  error, 
  page, 
  onPageChange,
  search,
  category 
}: FilesTableProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return await apiRequest("DELETE", `/api/files/${fileId}`);
    },
    onSuccess: () => {
      toast({
        title: "File deleted",
        description: "The file has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelectFile = (fileId: string, checked: boolean) => {
    if (checked) {
      setSelectedFiles(prev => [...prev, fileId]);
    } else {
      setSelectedFiles(prev => prev.filter(id => id !== fileId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.files) {
      setSelectedFiles(data.files.map(file => file.id));
    } else {
      setSelectedFiles([]);
    }
  };

  const handleDelete = (fileId: string) => {
    if (confirm("Are you sure you want to delete this file?")) {
      deleteMutation.mutate(fileId);
    }
  };

  const handleCopyLink = async (fileId: string) => {
    try {
      const fileUrl = `${window.location.origin}/api/files/${fileId}/view`;
      await navigator.clipboard.writeText(fileUrl);
      toast({
        title: "Link copied",
        description: "File link copied to clipboard. You can now paste it in a new browser window.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy link to clipboard.",
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-destructive" data-testid="text-error">Failed to load files. Please try again.</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <LoaderIcon className="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
        <p className="text-muted-foreground" data-testid="text-loading">Loading files...</p>
      </Card>
    );
  }

  if (!data || data.files.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground" data-testid="text-no-files">
          No files found. {search || category ? "" : "Upload your first file to get started."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" data-testid="card-files-table">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {/* <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Checkbox
                  checked={selectedFiles.length === data.files.length}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all"
                />
              </th> */}
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                File Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.files.map((file) => (
              <tr 
                key={file.id} 
                className="hover:bg-muted/30 transition-colors"
                data-testid={`row-file-${file.id}`}
              >
                {/* <td className="px-6 py-4 whitespace-nowrap">
                  <Checkbox
                    checked={selectedFiles.includes(file.id)}
                    onCheckedChange={(checked) => handleSelectFile(file.id, !!checked)}
                    data-testid={`checkbox-file-${file.id}`}
                  />
                </td> */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", getFileIconBg(file.mimeType))}>
                      {getFileIcon(file.mimeType)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground" data-testid={`text-filename-${file.id}`}>
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`text-filesize-${file.id}`}>
                        {formatBytes(file.size)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-muted-foreground" data-testid={`text-date-${file.id}`}>
                    {formatDate(file.uploadedAt)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => handleCopyLink(file.id)}
                      className="p-3 text-white  rounded transition-colors duration-200  hover:scale-105"
                      data-testid={`button-copy-link-${file.id}`}
                    >
                      Copy Link
                    </Button>

                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDelete(file.id)}
                      disabled={deleteMutation.isPending}
                      className="p-3 text-white  rounded transition-colors duration-200  hover:scale-105"
                      data-testid={`button-delete-${file.id}`}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-card px-6 py-4 border-t border-border flex items-center justify-between">
        <div className="flex items-center text-sm text-muted-foreground" data-testid="text-pagination-info">
          Showing <span className="font-medium text-foreground m-1">{((page - 1) * 10) + 1}</span> to{' '}
          <span className="font-medium text-foreground m-1">{Math.min(page * 10, data.total)}</span> of{' '}
          <span className="font-medium text-foreground m-1">{data.total}</span> results
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            data-testid="button-prev-page"
          >
            <ChevronLeftIcon className="w-4 h-4 mr-1" />
            Previous
          </Button>
          
          {/* Page numbers */}
          {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
            const pageNum = Math.max(1, Math.min(data.totalPages - 4, page - 2)) + i;
            if (pageNum > data.totalPages) return null;
            
            return (
              <Button
                key={pageNum}
                variant={pageNum === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                data-testid={`button-page-${pageNum}`}
              >
                {pageNum}
              </Button>
            );
          })}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= data.totalPages}
            data-testid="button-next-page"
          >
            Next
            <ChevronRightIcon className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

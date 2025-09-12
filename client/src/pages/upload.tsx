import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import UploadZone from "@/components/upload-zone";
import ProgressIndicator from "@/components/progress-indicator";
import { Card } from "@/components/ui/card";
import { FileIcon, CheckCircleIcon } from "lucide-react";

interface UploadedFile {
  id: string;
  name: string;
  originalName: string;
  size: number;
  category: string;
  amount?: string;
  isProcessed: boolean;
  uploadProgress?: number;
}

export default function Upload() {
  const [uploadingFiles, setUploadingFiles] = useState<UploadedFile[]>([]);
  const { toast } = useToast();


  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Files uploaded successfully",
        description: `${data.files.length} file(s) processed and categorized`,
      });
      
      // Update uploading files to show completed
      setUploadingFiles(prev => 
        prev.map(file => ({ ...file, isProcessed: true, uploadProgress: 100 }))
      );

      // Clear uploading files after a delay
      setTimeout(() => {
        setUploadingFiles([]);
      }, 2000);

      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadingFiles([]);
    },
  });

  const handleFileUpload = (files: FileList) => {
    // Create temporary upload entries for progress tracking
    const tempFiles = Array.from(files).map(file => ({
      id: Math.random().toString(36),
      name: file.name,
      originalName: file.name,
      size: file.size,
      category: 'Processing...',
      isProcessed: false,
      uploadProgress: 0,
    }));

    setUploadingFiles(tempFiles);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setUploadingFiles(prev => 
        prev.map(file => ({
          ...file,
          uploadProgress: Math.min((file.uploadProgress || 0) + Math.random() * 30, 95)
        }))
      );
    }, 500);

    uploadMutation.mutate(files);

    // Clear interval when upload completes
    setTimeout(() => {
      clearInterval(progressInterval);
    }, 3000);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2" data-testid="text-page-title">
            Upload Files
          </h1>
          <p className="text-muted-foreground">
            Upload a single or multiple PDF files up to 10MB each.
          </p>
        </div>

        {/* Upload Area */}
        <section>
          {/* <h2 className="text-lg font-medium text-foreground mb-4">Upload Documents</h2> */}
          <UploadZone onFileUpload={handleFileUpload} />
        </section>

        {/* Recent Uploads with Progress */}
        {uploadingFiles.length > 0 && (
          <section>
            <h2 className="text-lg font-medium text-foreground mb-4">Recent Uploads</h2>
            <div className="space-y-3">
              {uploadingFiles.map((file) => (
                <Card key={file.id} className="p-4" data-testid={`card-upload-${file.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        {file.isProcessed ? (
                          <CheckCircleIcon className="w-4 h-4 text-primary" />
                        ) : (
                          <FileIcon className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm" data-testid={`text-filename-${file.id}`}>
                          {file.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {Math.round(file.size / 1024)} KB • {file.isProcessed ? 'Processed' : 'Processing...'}
                        </p>
                      </div>
                    </div>
                    {!file.isProcessed && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(file.uploadProgress || 0)}%
                      </span>
                    )}
                  </div>
                  {!file.isProcessed && (
                    <ProgressIndicator progress={file.uploadProgress || 0} />
                  )}
                  {file.isProcessed && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {file.category}
                      </span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { UploadIcon, FileIcon } from "lucide-react";

interface UploadZoneProps {
  onFileUpload: (files: FileList) => void;
}

export default function UploadZone({ onFileUpload }: UploadZoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      // Convert File[] to FileList-like object
      const dt = new DataTransfer();
      acceptedFiles.forEach(file => dt.items.add(file));
      onFileUpload(dt.files);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 10,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  return (
    <Card 
      {...getRootProps()}
      className={`relative p-8 border-2 border-dashed cursor-pointer transition-colors ${
        isDragActive 
          ? 'border-primary bg-primary/5' 
          : 'border-border hover:border-primary/50 hover:bg-primary/5'
      }`}
      data-testid="upload-zone"
    >
      <input {...getInputProps()} />
      <div className="text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
          {isDragActive ? (
            <FileIcon className="w-6 h-6 text-primary" />
          ) : (
            <UploadIcon className="w-6 h-6 text-primary" />
          )}
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          {isDragActive ? 'Drop files here' : 'Upload your files'}
        </h3>
        <p className="text-muted-foreground mb-4">
          {isDragActive 
            ? 'Release to upload these files' 
            : 'Drag and drop your files here'
          }
        </p>
        <div className="text-xs text-muted-foreground">
          Supports PNG, JPG, GIF, and PDF files up to 10MB each
        </div>
      </div>
    </Card>
  );
}
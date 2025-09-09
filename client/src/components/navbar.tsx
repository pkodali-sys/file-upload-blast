import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SettingsIcon, DownloadIcon } from "lucide-react";

export default function Navbar() {
  const [location] = useLocation();
  
  const isUploadActive = location === "/" || location === "/upload";
  const isFilesActive = location === "/files";

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-primary rounded-xs flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">FI</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground" data-testid="text-brand-name">File Upload</h1>
              <p className="text-xs text-muted-foreground">Email blasting project</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 bg-secondary rounded-lg p-1">
            <Link href="/">
              <Button
                variant="ghost"
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  isUploadActive
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                data-testid="button-tab-upload"
              >
                Upload
              </Button>
            </Link>
            <Link href="/files">
              <Button
                variant="ghost"
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  isFilesActive
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                data-testid="button-tab-files"
              >
                Uploaded Files
              </Button>
            </Link>
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {/* <Button 
              variant="ghost" 
              size="sm"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent"
              data-testid="button-download"
            >
              <DownloadIcon className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent"
              data-testid="button-settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </Button>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-medium" data-testid="text-user-avatar">JD</span>
            </div> */}
          </div>
        </div>
      </div>
    </header>
  );
}

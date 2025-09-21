import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// UPDATE your imports to include these:
import { LogOut, User, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Navbar() {
  const [location] = useLocation();
  const { user, logoutMutation, sessionTimer } = useAuth();

  
  const isUploadActive = location === "/" || location === "/upload";
  const isFilesActive = location === "/files";

    const handleLogout = () => {
    logoutMutation.mutate();
  };

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
                    : "text-muted-foreground hover:bg-accent hover:text-stone-300"
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
                    : "text-muted-foreground hover:bg-accent hover:text-stone-300"
                )}
                data-testid="button-tab-files"
              >
                Uploaded Files
              </Button>
            </Link>
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {/* Replace your existing user menu with this */}
            {user && (
              <>
                <div className="flex items-center space-x-2 text-sm">
                  <User className="h-4 w-4" />
                  <span className="text-muted-foreground" data-testid="text-username">{user.username}</span>
                </div>
                {sessionTimer.remainingMs > 0 && (
                  <div className="flex items-center space-x-2 text-sm px-2 py-1 bg-muted rounded-md">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span 
                      className={cn(
                        "font-mono text-xs",
                        sessionTimer.remainingMs <= 300000 
                          ? "text-destructive" // Red when <= 5 minutes
                          : sessionTimer.remainingMs <= 600000 
                          ? "text-yellow-600 dark:text-yellow-400" // Yellow when <= 10 minutes
                          : "text-muted-foreground" // Normal when > 10 minutes
                      )}
                      data-testid="text-session-remaining"
                    >
                      Session: {sessionTimer.remainingText}
                    </span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  data-testid="button-logout"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  {logoutMutation.isPending ? "Logging out..." : "Logout"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

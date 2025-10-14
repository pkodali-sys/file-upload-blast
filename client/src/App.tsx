import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Upload from "@/pages/upload";
import Files from "@/pages/files";
import Navbar from "@/components/navbar";
import { queryClient } from "./lib/queryClient";
import FtpStatus from "@/pages/FtpStatus";

import AuthPage from "@/pages/auth-page";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { useEffect } from "react";

function Router() {
  const [location] = useLocation();
  const isAuthPage = location === "/auth";


  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("_redirected")) {
      console.log("Detected redirected flag in React — sending user to Fisher Investments.");
      window.location.href = "https://www.fisherinvestments.com/";
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-background">
      {!isAuthPage && <Navbar />}
      <Switch>
        <ProtectedRoute path="/" component={Upload} />
        <ProtectedRoute path="/upload" component={Upload} />
        <ProtectedRoute path="/files" component={Files} />
        <Route path="/auth" component={AuthPage} />
        {/* <Route component={NotFound} /> */}
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
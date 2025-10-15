import { Switch, Route, useLocation } from "wouter";
import { useEffect, useState } from "react";
import NotFound from "@/pages/not-found";
import Upload from "@/pages/upload";
import Files from "@/pages/files";
import Navbar from "@/components/navbar";
import FtpStatus from "@/pages/FtpStatus";
import AuthPage from "@/pages/auth-page";
import { ProtectedRoute } from "@/lib/protected-route";
import { useAuth } from "@/hooks/use-auth";
import TermsModal from "./terms-modal";

function Router() {
  const [location] = useLocation();
  const isAuthPage = location === "/auth";
  const { user, logoutMutation } = useAuth(); // get logged-in user
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("_redirected")) {
      console.log(
        "Detected redirected flag in React — sending user to Fisher Investments."
      );
      window.location.href = "https://www.fisherinvestments.com/";
    }
  }, [location]);

  const handleAccept = () => setAcceptedTerms(true);
  const handleLogout = () => {
    logoutMutation.mutate();
    window.location.href = "/auth";
  };

  return (
    <div className="min-h-screen bg-background">
      {!isAuthPage && <Navbar />}

      {/* Show Terms Modal only for logged-in users who haven't accepted */}
      {user && !acceptedTerms && (
        <TermsModal onAccept={handleAccept} onLogout={handleLogout} />
      )}

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

export default Router;

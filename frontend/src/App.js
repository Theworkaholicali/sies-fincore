import "@/App.css";
import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import StartupLoader from "@/components/StartupLoader";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Finance from "@/pages/Finance";
import Accounting from "@/pages/Accounting";
import Fees from "@/pages/Fees";
import Budget from "@/pages/Budget";
import Procurement from "@/pages/Procurement";
import Analytics from "@/pages/Analytics";
import Audit from "@/pages/Audit";
import AIAssistant from "@/pages/AIAssistant";
import { Assets, Grants, Reports, Documents, Administration } from "@/pages/Simple";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading...
      </div>
    );
  if (user === false) return <Navigate to="/login" replace />;
  return children;
}

function Shell() {
  return (
    <Protected>
      <AppShell />
    </Protected>
  );
}

function App() {
  const [booted, setBooted] = useState(() => sessionStorage.getItem("fincore-booted") === "1");

  if (!booted)
    return (
      <ThemeProvider>
        <StartupLoader
          onDone={() => {
            sessionStorage.setItem("fincore-booted", "1");
            setBooted(true);
          }}
        />
      </ThemeProvider>
    );

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Shell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/accounting" element={<Accounting />} />
              <Route path="/fees" element={<Fees />} />
              <Route path="/budget" element={<Budget />} />
              <Route path="/procurement" element={<Procurement />} />
              <Route path="/assets" element={<Assets />} />
              <Route path="/grants" element={<Grants />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/ai" element={<AIAssistant />} />
              <Route path="/admin" element={<Administration />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

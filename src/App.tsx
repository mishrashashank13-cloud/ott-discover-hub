import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { MovieDetails } from "./pages/MovieDetails";
import { TVShowDetails } from "./pages/TVShowDetails";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { Preferences } from "./pages/Preferences";
import { History } from "./pages/History";
import { AboutUs } from "./pages/AboutUs";
import { HowToUse } from "./pages/HowToUse";
import { ContactUs } from "./pages/ContactUs";
import { ResetPassword } from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navigation />
        {/* Single <main> landmark wrapping route content for screen-reader navigation */}
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/preferences" element={<Preferences />} />
            <Route path="/history" element={<History />} />
            <Route path="/search" element={<Search />} />
            <Route path="/movie/:id" element={<MovieDetails />} />
            <Route path="/tv/:id" element={<TVShowDetails />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/how-to-use" element={<HowToUse />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

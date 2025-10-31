import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { showSuccess, showError } from "@/lib/sweetalert";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, TrendingUp } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("email", email)
        .eq("password", password)
        .single();

      if (error || !data) {
        showError("Invalid credentials");
        return;
      }

      if (!data.is_active) {
        showError("Your account is inactive");
        return;
      }

      localStorage.setItem("employee", JSON.stringify(data));
      // Enable background location publishing for 24 hours
      localStorage.setItem("location_active_until", String(Date.now() + 24 * 60 * 60 * 1000));
      showSuccess("Welcome back!");
      
      if (data.role === "admin") {
        navigate("/admin");
      } else if (data.role === "department_head") {
        navigate("/department-head");
      } else {
        navigate("/employee");
      }
    } catch (error) {
      console.error("Login error:", error);
      showError("An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="bg-gradient-primary p-3 rounded-2xl shadow-glow">
              <MapPin className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            Task Vision
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Real-time Task Management Platform</p>
        </div>

        <Card className="p-6 sm:p-8 shadow-lg">
          <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@taskvision.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span>Powered by MIDIZ</span>
        </div>
      </div>
    </div>
  );
};

export default Login;

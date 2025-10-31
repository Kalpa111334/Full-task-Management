import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 300);
    }, 1500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-primary transition-opacity duration-300 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="text-center animate-fade-in">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-white/20 backdrop-blur-sm p-6 rounded-3xl shadow-glow animate-scale-in">
            <MapPin className="h-16 w-16 text-white" />
          </div>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 animate-fade-in">
          Task Vision
        </h1>
        <p className="text-lg md:text-2xl text-white/90 font-medium">
          Powered by MIDIZ
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;

import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="text-center max-w-md">
        <h1 className="mb-2 text-3xl sm:text-4xl font-bold">404</h1>
        <p className="mb-4 text-base sm:text-xl text-gray-600">Oops! Page not found</p>
        <a href="/" className="inline-block px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;

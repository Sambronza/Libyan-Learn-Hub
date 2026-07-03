import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Globally monkey-patch fetch to inject the auth token for all API requests
// Doing this here guarantees it runs synchronously BEFORE React and React Query initialize.
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const currentToken = localStorage.getItem('lms_token');
  if (currentToken) {
    init = init || {};
    
    // Properly merge headers, handling both plain objects and Headers instances
    const newHeaders = new Headers(init.headers);
    newHeaders.set('Authorization', `Bearer ${currentToken}`);
    init.headers = newHeaders;
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);

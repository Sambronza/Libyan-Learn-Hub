import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  schema?: Record<string, any>;
}

export function useSEO({ title, description, schema }: SEOProps) {
  useEffect(() => {
    // 1. Update Title
    const siteTitle = 'Libyan Learn Hub | منصة التعلم الليبية';
    const newTitle = title ? `${title} | ${siteTitle}` : siteTitle;
    document.title = newTitle;

    // 2. Update Meta Description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', description);

    // 3. Optional Structured JSON-LD Data
    let scriptTag = document.querySelector('#seo-schema-script');
    if (schema) {
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.id = 'seo-schema-script';
        scriptTag.setAttribute('type', 'application/ld+json');
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(schema);
    } else if (scriptTag) {
      // Remove schema if this page doesn't have one
      scriptTag.remove();
    }

    // Cleanup when component unmounts (optional, typically we want it to persist until next render)
    return () => {
      if (document.title === newTitle) {
        document.title = siteTitle;
      }
    };
  }, [title, description, schema]);
}

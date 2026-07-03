import React from 'react';
import { Link } from 'wouter';

interface LogoProps {
  size?: number;
  linked?: boolean;
  className?: string;
}

export function Logo({ size = 48, linked = true, className = '' }: LogoProps) {
  const logoHeight = Math.round(size * 0.55);
  const fontSize = Math.round(size * 0.28);
  const subFontSize = Math.round(size * 0.115);

  const content = (
    <div className={`flex items-center gap-2 select-none ${className}`} style={{ height: size }}>
      {/* Icon mark */}
      <div
        className="flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-500 shadow-md shadow-primary/25 flex-shrink-0"
        style={{ width: logoHeight, height: logoHeight }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: logoHeight * 0.6, height: logoHeight * 0.6 }}
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      {/* Word mark */}
      <div className="flex flex-col leading-none">
        <span
          className="font-display font-extrabold tracking-tight bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent"
          style={{ fontSize }}
        >
          EduLibya
        </span>
        <span
          className="text-muted-foreground font-medium hidden sm:block"
          style={{ fontSize: subFontSize, marginTop: 2 }}
        >
          تعلّم · ارتقِ · ابتكر
        </span>
      </div>
    </div>
  );

  if (linked) {
    return (
      <Link href="/" className="flex items-center hover:opacity-90 transition-opacity duration-200">
        {content}
      </Link>
    );
  }

  return <div className="flex items-center">{content}</div>;
}

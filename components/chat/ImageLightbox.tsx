"use client";

import React, { useEffect, useCallback } from "react";
import Image from "next/image";
import { X, Download } from "lucide-react";

interface ImageLightboxProps {
  imageUrl: string;
  onClose: () => void;
}

export function ImageLightbox({ imageUrl, onClose }: ImageLightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = imageUrl.split("/").pop() ?? "image";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90" />

      {/* Top bar */}
      <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm">
        {/* Download */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-all hover:bg-white/20 hover:text-white"
          title="Download image"
        >
          <Download className="h-4 w-4" />
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-all hover:bg-white/20 hover:text-white"
          title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Image at original size */}
      <Image
        src={imageUrl}
        alt="Full size"
        fill
        onClick={(e) => e.stopPropagation()}
        className="cursor-default rounded-lg shadow-2xl object-contain"
        style={{ objectFit: "contain" }}
        sizes="90vw"
        priority
      />
    </div>
  );
}

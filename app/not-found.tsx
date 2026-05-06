"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Home, Search, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-orange-600/5 rounded-full blur-3xl" />
      </div>
      
      <div className="text-center relative z-10 max-w-lg">
        {/* Illustration */}
        <div className="mb-6 flex justify-center">
          <Image
            src="/page-not-found.png"
            alt="Страница не найдена"
            width={320}
            height={240}
            className="w-64 md:w-80 h-auto drop-shadow-2xl"
            priority
          />
        </div>

        {/* 404 Number */}
        <div className="text-[100px] md:text-[140px] font-bold leading-none mb-2">
          <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
            404
          </span>
        </div>
        
        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Страница не найдена
        </h1>
        
        {/* Description */}
        <p className="text-neutral-400 text-lg mb-8">
          К сожалению, запрашиваемая страница не существует или была перемещена.
        </p>
        
        {/* Actions */}
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/">
            <Button size="lg" className="gap-2">
              <Home className="h-5 w-5" />
              На главную
            </Button>
          </Link>
          <Link href="/catalog">
            <Button size="lg" variant="outline" className="gap-2">
              <Search className="h-5 w-5" />
              В каталог
            </Button>
          </Link>
        </div>
        
        {/* Back Link */}
        <div className="mt-8">
          <button 
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 text-neutral-500 hover:text-orange-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Вернуться назад
          </button>
        </div>
      </div>
    </div>
  );
}

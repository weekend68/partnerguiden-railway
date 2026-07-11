"use client";

import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  decay: number;
}

interface Firework {
  id: number;
  x: number;
  y: number;
  targetY: number;
  color: string;
  exploded: boolean;
  particles: Particle[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(340, 80%, 60%)",
  "hsl(45, 100%, 60%)",
  "hsl(180, 80%, 60%)",
  "hsl(280, 80%, 60%)",
  "hsl(120, 80%, 50%)",
];

export function Fireworks({ duration = 4000 }: { duration?: number }) {
  const [fireworks, setFireworks] = useState<Firework[]>([]);
  const [isLaunching, setIsLaunching] = useState(true);
  const [containerOpacity, setContainerOpacity] = useState(1);

  useEffect(() => {
    const createFirework = () => {
      const id = Date.now() + Math.random();
      const x = Math.random() * 100;
      const targetY = 20 + Math.random() * 30;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];

      return {
        id,
        x,
        y: 100,
        targetY,
        color,
        exploded: false,
        particles: [],
      };
    };

    const createParticles = (x: number, y: number, color: string): Particle[] => {
      const particles: Particle[] = [];
      const particleCount = 30 + Math.floor(Math.random() * 20);

      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
        const speed = 2 + Math.random() * 3;
        particles.push({
          id: i,
          x,
          y,
          color: Math.random() > 0.3 ? color : COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 2 + Math.random() * 3,
          speedX: Math.cos(angle) * speed,
          speedY: Math.sin(angle) * speed,
          opacity: 1,
          decay: 0.02 + Math.random() * 0.015, // Slightly faster decay
        });
      }
      return particles;
    };

    // Launch fireworks at intervals
    let launchInterval: ReturnType<typeof setInterval> | null = null;
    
    if (isLaunching) {
      launchInterval = setInterval(() => {
        const count = 1 + Math.floor(Math.random() * 2);
        const newFireworks = Array.from({ length: count }, createFirework);
        setFireworks((prev) => [...prev, ...newFireworks]);
      }, 300);
    }

    // Animation loop
    const animationInterval = setInterval(() => {
      setFireworks((prev) => {
        return prev
          .map((fw) => {
            if (!fw.exploded) {
              // Rising firework
              const newY = fw.y - 2;
              if (newY <= fw.targetY) {
                return {
                  ...fw,
                  y: fw.targetY,
                  exploded: true,
                  particles: createParticles(fw.x, fw.targetY, fw.color),
                };
              }
              return { ...fw, y: newY };
            } else {
              // Update particles with smoother fade
              const updatedParticles = fw.particles
                .map((p) => ({
                  ...p,
                  x: p.x + p.speedX * 0.3,
                  y: p.y + p.speedY * 0.3,
                  speedX: p.speedX * 0.98, // Slow down horizontally
                  speedY: p.speedY + 0.05, // gravity
                  opacity: p.opacity - p.decay,
                  size: p.size * 0.99, // Shrink particles as they fade
                }))
                .filter((p) => p.opacity > 0.05); // Remove almost invisible

              return { ...fw, particles: updatedParticles };
            }
          })
          .filter((fw) => !fw.exploded || fw.particles.length > 0);
      });
    }, 16);

    // Stop launching new fireworks after duration
    const stopLaunchTimeout = setTimeout(() => {
      setIsLaunching(false);
      if (launchInterval) clearInterval(launchInterval);
    }, duration);

    // Start fade out after duration + buffer for last explosions
    const fadeOutTimeout = setTimeout(() => {
      // Gradual fade out of the entire container
      const fadeSteps = 20;
      const fadeInterval = setInterval(() => {
        setContainerOpacity((prev) => {
          const newOpacity = prev - (1 / fadeSteps);
          if (newOpacity <= 0) {
            clearInterval(fadeInterval);
            return 0;
          }
          return newOpacity;
        });
      }, 50);
    }, duration + 500);

    return () => {
      if (launchInterval) clearInterval(launchInterval);
      clearInterval(animationInterval);
      clearTimeout(stopLaunchTimeout);
      clearTimeout(fadeOutTimeout);
    };
  }, [isLaunching, duration]);

  // Hide completely when faded out and no fireworks left
  if (containerOpacity <= 0 && fireworks.length === 0) return null;

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden transition-opacity duration-500"
      style={{ opacity: containerOpacity }}
    >
      {fireworks.map((fw) => (
        <div key={fw.id}>
          {/* Rising trail */}
          {!fw.exploded && (
            <div
              className="absolute w-1 h-4 rounded-full animate-pulse"
              style={{
                left: `${fw.x}%`,
                top: `${fw.y}%`,
                background: fw.color,
                boxShadow: `0 0 6px 2px ${fw.color}`,
              }}
            />
          )}
          {/* Explosion particles */}
          {fw.particles.map((p) => (
            <div
              key={`${fw.id}-${p.id}`}
              className="absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                background: p.color,
                opacity: p.opacity,
                boxShadow: `0 0 ${p.size}px ${p.color}`,
                transform: "translate(-50%, -50%)",
                transition: "opacity 0.1s ease-out",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
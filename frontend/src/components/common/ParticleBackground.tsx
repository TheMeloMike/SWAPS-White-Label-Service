import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';

interface ParticleBackgroundProps {
  particleCount?: number;
  speed?: number;
  color?: string;
  interactive?: boolean;
  density?: number;
  size?: number;
  className?: string;
}

const Container = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
`;

const Canvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

interface Particle {
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  size: number;
  color: string;
}

/**
 * A component that renders an animated particle background
 * Great for creating a dynamic, attention-grabbing effect on pages
 */
const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  particleCount = 70,
  speed = 0.5,
  color = 'rgba(123, 97, 255, 0.5)',
  interactive = true,
  density = 9000, // Lower means particles will be more affected by mouse
  size = 3,
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: null as number | null, y: null as number | null });
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    // Create particles
    const createParticles = () => {
      particlesRef.current = [];
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          directionX: (Math.random() * 2) - 1, // -1 to 1
          directionY: (Math.random() * 2) - 1, // -1 to 1
          size: Math.random() * size + 1,
          color
        });
      }
    };

    const drawParticles = () => {
      ctx.clearRect(0, 0, width, height);
      
      for (const p of particlesRef.current) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
    };

    const updateParticles = () => {
      for (const p of particlesRef.current) {
        // Move particles
        p.x += p.directionX * speed;
        p.y += p.directionY * speed;
        
        // Bounce off edges
        if (p.x < 0 || p.x > width) {
          p.directionX = -p.directionX;
        }
        if (p.y < 0 || p.y > height) {
          p.directionY = -p.directionY;
        }
        
        // Mouse interaction
        if (interactive && mouseRef.current.x !== null && mouseRef.current.y !== null) {
          const dx = p.x - mouseRef.current.x;
          const dy = p.y - mouseRef.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Move particles away from mouse cursor within a certain radius
          if (distance < 100) {
            const angle = Math.atan2(dy, dx);
            const force = (100 - distance) / density;
            
            p.directionX += Math.cos(angle) * force;
            p.directionY += Math.sin(angle) * force;
          }
        }
      }
    };

    const drawConnections = () => {
      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const p1 = particlesRef.current[i];
          const p2 = particlesRef.current[j];
          
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Draw connections between nearby particles
          if (distance < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(123, 97, 255, ${0.2 - (distance / 120) * 0.2})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      drawParticles();
      updateParticles();
      drawConnections();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      createParticles(); // Regenerate particles to fill the new dimensions
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (interactive) {
        mouseRef.current.x = e.clientX;
        mouseRef.current.y = e.clientY;
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = null;
      mouseRef.current.y = null;
    };

    // Initialize
    createParticles();
    animate();

    // Event listeners
    window.addEventListener('resize', handleResize);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [particleCount, speed, color, interactive, density, size]);

  return (
    <Container className={className}>
      <Canvas ref={canvasRef} />
    </Container>
  );
};

export default ParticleBackground; 
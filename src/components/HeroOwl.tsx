import { useEffect, useRef } from 'react';

interface OwlLookPosition {
  x: number;
  y: number;
}

export default function HeroOwl() {
  const owlRef = useRef<HTMLImageElement>(null);
  const targetRef = useRef<OwlLookPosition>({ x: 0, y: 0 });
  const currentRef = useRef<OwlLookPosition>({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;

      targetRef.current = {
        x: Math.max(-1, Math.min(1, (event.clientX / window.innerWidth - 0.5) * 2)),
        y: Math.max(-1, Math.min(1, (event.clientY / window.innerHeight - 0.5) * 2)),
      };
    };

    const resetToCentre = () => {
      targetRef.current = { x: 0, y: 0 };
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', resetToCentre);
    window.addEventListener('blur', resetToCentre);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.documentElement.removeEventListener('mouseleave', resetToCentre);
      window.removeEventListener('blur', resetToCentre);
    };
  }, []);

  useEffect(() => {
    const followPointer = () => {
      const current = currentRef.current;
      const target = targetRef.current;
      current.x += (target.x - current.x) * 0.09;
      current.y += (target.y - current.y) * 0.09;

      const owl = owlRef.current;
      if (owl) {
        owl.style.setProperty('--owl-shift-x', `${current.x * 14}px`);
        owl.style.setProperty('--owl-shift-y', `${current.y * 9}px`);
        owl.style.setProperty('--owl-rotate-x', `${current.y * -4}deg`);
        owl.style.setProperty('--owl-rotate-y', `${current.x * 7}deg`);
      }

      animationFrameRef.current = window.requestAnimationFrame(followPointer);
    };

    animationFrameRef.current = window.requestAnimationFrame(followPointer);
    return () => {
      if (animationFrameRef.current !== undefined) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="hero-owl" aria-label="Interactive Vetoschool owl">
      <img
        ref={owlRef}
        className="hero-owl__image"
        src="/owl/hero-owl-cutout.png"
        alt="Vetoschool owl"
        draggable={false}
      />
    </div>
  );
}

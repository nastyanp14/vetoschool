import { motion } from 'framer-motion';

const letters = [
  { char: 'A', color: '#FFB3D1', x: '8%', y: '15%', delay: 0, size: 'text-5xl' },
  { char: 'B', color: '#B3D9FF', x: '88%', y: '12%', delay: 0.5, size: 'text-4xl' },
  { char: 'C', color: '#C8B3FF', x: '5%', y: '55%', delay: 1, size: 'text-6xl' },
  { char: 'D', color: '#B3F0E0', x: '92%', y: '60%', delay: 1.5, size: 'text-3xl' },
  { char: 'E', color: '#FFD4B3', x: '15%', y: '80%', delay: 0.3, size: 'text-4xl' },
  { char: 'F', color: '#FFB3D1', x: '82%', y: '82%', delay: 0.8, size: 'text-5xl' },
];

const stars = [
  { x: '20%', y: '20%', delay: 0.2, size: 16 },
  { x: '75%', y: '25%', delay: 0.7, size: 12 },
  { x: '10%', y: '70%', delay: 1.2, size: 20 },
  { x: '85%', y: '45%', delay: 0.4, size: 14 },
  { x: '50%', y: '10%', delay: 0.9, size: 10 },
  { x: '60%', y: '85%', delay: 1.4, size: 18 },
  { x: '30%', y: '90%', delay: 0.6, size: 12 },
];

const hearts = [
  { x: '25%', y: '35%', delay: 0.3, size: 'text-2xl' },
  { x: '70%', y: '70%', delay: 1.1, size: 'text-xl' },
  { x: '45%', y: '78%', delay: 0.6, size: 'text-3xl' },
];

export default function FloatingElements({ scrollY = 0 }: { scrollY?: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Floating ABC Letters */}
      {letters.map((l, i) => (
        <motion.div
          key={i}
          className={`absolute font-display font-black ${l.size} select-none`}
          style={{
            left: l.x,
            top: l.y,
            color: l.color,
            filter: `drop-shadow(0 4px 12px ${l.color}80)`,
            y: -scrollY * (0.05 + i * 0.02),
          }}
          initial={{ opacity: 0, scale: 0, rotate: -20 }}
          animate={{
            opacity: 0.85,
            scale: 1,
            rotate: 0,
            y: [0, -14, -6, -14, 0],
          }}
          transition={{
            opacity: { delay: l.delay, duration: 0.6 },
            scale: { delay: l.delay, duration: 0.6, type: 'spring', stiffness: 200 },
            rotate: { delay: l.delay, duration: 0.6 },
            y: { delay: l.delay + 0.6, duration: 4 + i * 0.3, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          {l.char}
        </motion.div>
      ))}

      {/* Stars */}
      {stars.map((s, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute text-yellow-300"
          style={{ left: s.x, top: s.y }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0.4, 1, 0.4],
            scale: [0.8, 1.2, 0.8],
            rotate: [0, 180, 360],
          }}
          transition={{
            delay: s.delay,
            duration: 3 + i * 0.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        </motion.div>
      ))}

      {/* Hearts */}
      {hearts.map((h, i) => (
        <motion.div
          key={`heart-${i}`}
          className={`absolute ${h.size}`}
          style={{ left: h.x, top: h.y }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0.5, 0.9, 0.5],
            scale: [0.9, 1.15, 0.9],
            y: [0, -10, 0],
          }}
          transition={{
            delay: h.delay,
            duration: 3.5 + i * 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          ♥️
        </motion.div>
      ))}

      {/* Clouds */}
      <motion.div
        className="absolute"
        style={{ left: '3%', top: '30%' }}
        animate={{ x: [0, 15, 0], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="text-5xl opacity-70">☁️</div>
      </motion.div>
      <motion.div
        className="absolute"
        style={{ right: '5%', top: '40%' }}
        animate={{ x: [0, -12, 0], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      >
        <div className="text-4xl opacity-60">☁️</div>
      </motion.div>

      {/* Sparkle dots */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={`dot-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${10 + i * 11}%`,
            top: `${20 + (i % 3) * 25}%`,
            width: 6 + (i % 3) * 2,
            height: 6 + (i % 3) * 2,
            background: ['#FFB3D1', '#C8B3FF', '#B3D9FF', '#B3F0E0'][i % 4],
          }}
          animate={{
            opacity: [0.3, 0.8, 0.3],
            scale: [0.8, 1.4, 0.8],
          }}
          transition={{
            delay: i * 0.3,
            duration: 2 + i * 0.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

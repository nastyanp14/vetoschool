import { motion } from 'framer-motion';

export default function BookHero() {
  return (
    <motion.div
      className="relative w-64 h-64 md:w-80 md:h-80 mx-auto"
      animate={{ y: [0, -12, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Glow ring */}
      <motion.div
        className="absolute inset-4 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,179,209,0.4) 0%, rgba(200,179,255,0.3) 50%, transparent 70%)',
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Main book circle */}
      <div
        className="absolute inset-0 rounded-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,240,250,0.85) 50%, rgba(240,235,255,0.85) 100%)',
          boxShadow: '0 20px 60px rgba(200,150,220,0.3), 0 0 0 2px rgba(255,179,209,0.3), inset 0 1px 0 rgba(255,255,255,0.9)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Book emoji large */}
        <div className="relative">
          <div className="text-8xl md:text-9xl filter drop-shadow-lg">
            📖
          </div>
          {/* Heart overlay */}
          <motion.div
            className="absolute -top-2 left-1/2 -translate-x-1/2 text-3xl"
            animate={{ scale: [1, 1.3, 1], rotate: [-5, 5, -5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            ♥️
          </motion.div>
        </div>
      </div>

      {/* Orbiting sparkles */}
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 rounded-full"
          style={{
            background: ['#FFB3D1', '#C8B3FF', '#B3D9FF', '#B3F0E0', '#FFD4B3', '#FFB3D1'][i],
            top: '50%',
            left: '50%',
          }}
          animate={{
            x: Math.cos((deg * Math.PI) / 180) * 120,
            y: Math.sin((deg * Math.PI) / 180) * 120,
            scale: [1, 1.5, 1],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            x: { duration: 0.01 },
            y: { duration: 0.01 },
            scale: { delay: i * 0.2, duration: 2, repeat: Infinity, ease: 'easeInOut' },
            opacity: { delay: i * 0.2, duration: 2, repeat: Infinity, ease: 'easeInOut' },
          }}
        />
      ))}

      {/* Twinkling stars around */}
      {[45, 135, 225, 315].map((deg, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute text-yellow-300 text-xl"
          style={{
            top: `${50 + Math.sin((deg * Math.PI) / 180) * 45}%`,
            left: `${50 + Math.cos((deg * Math.PI) / 180) * 45}%`,
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [0.7, 1.2, 0.7],
            rotate: [0, 360],
          }}
          transition={{
            delay: i * 0.4,
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          ✨
        </motion.div>
      ))}
    </motion.div>
  );
}

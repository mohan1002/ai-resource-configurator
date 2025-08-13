'use client'

import { motion } from 'framer-motion'

export default function DarkVeil() {
  return (
    <motion.div
      className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    />
  )
}